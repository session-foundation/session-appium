import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type CommunityRoom = {
  link: string;
  name: string;
  roomName: string;
};

/**
 * Per-test community rooms.
 *
 * The community specs used to share a fixed set of rooms, so two runs against the same SOGS — CI and
 * a laptop, or two CI jobs — joined, posted, pinned and banned in the same place. Each test now gets
 * rooms of its own, which also means a test is free to leave a room in whatever state it likes.
 *
 * Only possible against a local SOGS: creating a room has no HTTP endpoint in PySOGS, so it goes
 * through `room.sh` (which shells into the container). When COMMUNITY_LINK is unset the suite is
 * pointed at the shared remote communities and there is nothing we can create, so allocation is
 * disabled and the static list in constants/community.ts is used exactly as before.
 *
 * State here is module-level, which is per-worker (Playwright workers are separate processes) and
 * therefore safe: tests within a worker run one at a time.
 */

/**
 * How rooms are managed. Two implementations, differing only in how they reach SOGS — the room
 * semantics, including the `qa-` prefix rule and the gc TTL, are enforced on the server either way.
 *
 * `gc` returns its own one-line summary rather than counts: the CLI already prints one, and parsing it
 * back into numbers just to reformat it would be a brittle way to reach the same log line.
 */
type RoomTransport = {
  create(token: string, name: string): Promise<void>;
  /** Shown in the "per-test rooms enabled" line. */
  readonly describe: string;
  gc(olderThanSeconds: number): Promise<string>;
  /** Rejects when rooms can't be managed. Used as the availability check by `probePerTestRooms`. */
  check(): Promise<void>;
  remove(token: string): Promise<void>;
};

// Default assumes Sesh-Net-Docker is checked out alongside this repo; override in .env when it isn't.
const roomCliPath = () =>
  process.env.SOGS_ROOM_CLI ?? path.resolve(process.cwd(), '../Sesh-Net-Docker/sogs/room.sh');

const roomApiBase = () => (process.env.SOGS_ROOM_API ?? '').trim().replace(/\/$/, '');
const roomApiToken = () => (process.env.SOGS_ROOM_API_TOKEN ?? '').trim();

/**
 * Chosen from the environment once per process, then reused.
 *
 * Not chosen in `probePerTestRooms` and stored for everyone: workers are separate processes and
 * inherit the env, not module state, so each derives this for itself. Deriving it once per process
 * rather than per call is what stops four call sites disagreeing if the environment changes mid-run.
 */
let transport: RoomTransport | undefined;

function roomTransport(): RoomTransport {
  transport ??= roomApiBase() === '' ? cliTransport() : apiTransport();
  return transport;
}

/**
 * Shells into the container via Sesh-Net-Docker's `room.sh`. The default when nothing else is
 * configured, because it needs no token and no exposed port — with that repo checked out alongside
 * this one it works with nothing set but COMMUNITY_LINK.
 */
function cliTransport(): RoomTransport {
  const run = async (args: Array<string>): Promise<string> => {
    const { stdout } = await execFileAsync(roomCliPath(), args, { timeout: 60_000 });
    return stdout.trim();
  };

  return {
    check: async () => {
      const cli = roomCliPath();
      if (!existsSync(cli)) {
        throw new Error(
          `no room CLI at ${cli} and SOGS_ROOM_API is unset. Point SOGS_ROOM_CLI at your ` +
            `Sesh-Net-Docker checkout's sogs/room.sh, or set SOGS_ROOM_API + SOGS_ROOM_API_TOKEN`
        );
      }
      await run(['list']);
    },
    create: async (token, name) => void (await run(['create', token, '--name', name])),
    describe: `room CLI at ${roomCliPath()}`,
    gc: async olderThanSeconds =>
      (await run(['gc', '--older-than', String(olderThanSeconds)])).split('\n')[0],
    remove: async token => void (await run(['delete', token])),
  };
}

/**
 * Talks to `sogs/room_api.py` over HTTP. For hosts that can reach the SOGS container but can't
 * `docker exec` into it — a CI runner driving a devnet that lives on another host. Takes precedence
 * when SOGS_ROOM_API is set, since it is the deliberate choice of the two.
 */
function apiTransport(): RoomTransport {
  const call = async (
    method: 'DELETE' | 'GET' | 'POST',
    route: string,
    body?: unknown
  ): Promise<unknown> => {
    const token = roomApiToken();
    if (!token) {
      // `check` reports this properly; reaching it here would mean the token was cleared mid-run.
      throw new Error('SOGS_ROOM_API_TOKEN is empty');
    }

    const response = await fetch(`${roomApiBase()}${route}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      method,
      signal: AbortSignal.timeout(60_000),
    });

    const text = await response.text();
    if (!response.ok) {
      // The API answers refusals as JSON `{error}`; surface that rather than a bare status.
      let detail = text;
      try {
        detail = (JSON.parse(text) as { error?: string }).error ?? text;
      } catch {
        // Not JSON — a proxy or the wrong port. The raw body is more use than a parse error.
      }
      throw new Error(`room API ${method} ${route} failed (HTTP ${response.status}): ${detail}`);
    }
    return text === '' ? {} : (JSON.parse(text) as unknown);
  };

  return {
    check: async () => {
      // Checked before any request so a missing token reads as the configuration mistake it is.
      // Left to the request it would surface as a transport failure, sending people to look at the
      // network instead of at their env — and forgetting the token is the likeliest slip here.
      if (!roomApiToken()) {
        throw new Error(
          `SOGS_ROOM_API is set to ${roomApiBase()} but SOGS_ROOM_API_TOKEN is empty. Set it to ` +
            `the same value as the sogs container's SOGS_ROOM_API_TOKEN`
        );
      }
      await call('GET', '/rooms');
    },
    create: async (token, name) => void (await call('POST', '/rooms', { name, token })),
    describe: `room API at ${roomApiBase()}`,
    gc: async olderThanSeconds => {
      const result = (await call('POST', '/rooms/gc', { older_than: olderThanSeconds })) as {
        kept?: string[];
        removed?: string[];
      };
      return (
        `gc: removed ${result.removed?.length ?? 0} room(s), left ` +
        `${result.kept?.length ?? 0} inside the ${olderThanSeconds}s TTL.`
      );
    },
    remove: async token => void (await call('DELETE', `/rooms/${encodeURIComponent(token)}`)),
  };
}

let allocated: CommunityRoom[] = [];
let allocationCounter = 0;

/**
 * Env var carrying the decision from global-setup to the workers, which inherit this process's env.
 */
const ENABLED_FLAG = 'PER_TEST_COMMUNITY_ROOMS';

/**
 * Whether this run allocates its own rooms.
 *
 * A cheap read of a decision made once by `probePerTestRooms` — deliberately not a check. This is
 * called on every `communities` property access, so it must not touch the filesystem or the network,
 * and every caller must agree: a test that allocated rooms and a `communities` lookup that decided
 * otherwise would read a shared room while believing it had its own.
 *
 * Defaults to off when the probe hasn't run, so anything importing this outside a test run gets the
 * static list rather than attempting allocation.
 */
export function perTestRoomsEnabled(): boolean {
  return process.env[ENABLED_FLAG] === '1';
}

/**
 * Decide once, at the start of a run, whether per-test rooms are usable, and record it for the
 * workers.
 *
 * The check asks the transport, not SOGS: what matters is whether rooms can be *created*, and a
 * healthy SOGS API says nothing about that. Over the CLI it needs docker, a running container and a
 * working `room.py`; over HTTP it needs the room API up with a matching token. That distinction is
 * exactly the CI case — SOGS reachable over the network, its container on another host.
 *
 * An unusable transport falls back to the shared rooms rather than failing the run, since that
 * configuration still tests everything — it just can't isolate concurrent runs. The warning is
 * deliberately loud: sharing rooms silently while reporting green is the failure mode this feature
 * exists to remove, so it should be obvious in the log which mode a run used.
 */
export async function probePerTestRooms(): Promise<boolean> {
  if (!process.env.COMMUNITY_LINK) {
    // Pointed at the shared remote communities: nothing can be created, and that is a choice rather
    // than a misconfiguration, so it warrants no warning.
    process.env[ENABLED_FLAG] = '0';
    return false;
  }

  try {
    await roomTransport().check();
  } catch (e) {
    process.env[ENABLED_FLAG] = '0';
    console.warn(
      `\n⚠ Per-test community rooms are OFF — ${
        e instanceof Error ? e.message.split('\n')[0] : String(e)
      }\n` +
        `  Community tests will share the fixed rooms in run/constants/community.ts, so a run ` +
        `against the same SOGS elsewhere can interfere with this one.\n`
    );
    return false;
  }

  process.env[ENABLED_FLAG] = '1';
  console.log(`Per-test community rooms enabled (via ${roomTransport().describe})`);
  return true;
}

/**
 * Token for a room, unique across concurrent runs and workers.
 *
 * QA_RUN_ID is stamped once per run in global-setup; without it two runs starting together could
 * pick the same token and delete each other's rooms. The `qa-` prefix is what marks a room
 * disposable — room.py refuses to delete anything without it.
 */
function nextToken(): string {
  const runId = process.env.QA_RUN_ID ?? 'local';
  const worker = process.env.TEST_PARALLEL_INDEX ?? '0';
  allocationCounter += 1;
  return `qa-${runId}-w${worker}-${allocationCounter}`;
}

/**
 * The link room.py prints is built from the server's own URL_BASE, which is localhost — unreachable
 * from a simulator. The host that does work is already in COMMUNITY_LINK, so reuse its origin and
 * public_key and swap in the new token, mirroring buildLocalCommunities.
 */
function linkForToken(token: string): string {
  const base = new URL(process.env.COMMUNITY_LINK as string);
  return `${base.protocol}//${base.host}/${token}${base.search}`;
}

export async function allocateCommunityRooms(count: number): Promise<Array<CommunityRoom>> {
  // Published before the loop, not after, so `allocated` tracks partial progress: a create that
  // fails on room 3 of 6 has still created two, and releasing what exists is only possible if
  // something recorded them. Otherwise they linger until the gc sweep's TTL expires.
  const rooms: Array<CommunityRoom> = [];
  allocated = rooms;

  for (let i = 0; i < count; i++) {
    const token = nextToken();
    const name = `QA ${token}`;
    await roomTransport().create(token, name);
    rooms.push({ link: linkForToken(token), name, roomName: token });
  }
  return rooms;
}

/**
 * Best-effort: a room left behind is picked up by the gc sweep, so a failure to delete should never
 * turn a passing test red.
 */
export async function releaseCommunityRooms(): Promise<void> {
  const toRelease = allocated;
  allocated = [];
  for (const room of toRelease) {
    try {
      await roomTransport().remove(room.roomName);
    } catch (e) {
      console.warn(
        `Failed to delete community room "${room.roomName}" (gc will collect it): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }
}

export function getAllocatedRooms(): Array<CommunityRoom> {
  return allocated;
}

/**
 * Remove rooms orphaned by runs that were killed before teardown. The TTL is what stops this
 * deleting a room out from under a test that is still running, so it must comfortably exceed the
 * longest single test.
 */
export async function gcCommunityRooms(olderThanSeconds: number = 3_600): Promise<void> {
  if (!perTestRoomsEnabled()) {
    return;
  }
  try {
    console.log(await roomTransport().gc(olderThanSeconds));
  } catch (e) {
    console.warn(
      `Community room gc failed (continuing): ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
