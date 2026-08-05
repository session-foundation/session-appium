import {
  describeFailure,
  identityFromRecoveryPhrase,
  SogsIdentity,
  sogsRequest,
} from './sogs_auth';
import { buildSeedMessage } from './sogs_seed_message';

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
 * Only possible against a local SOGS, since it means creating and deleting rooms on it: when
 * COMMUNITY_LINK is unset the suite is pointed at the shared remote communities, allocation is
 * disabled, and the static list in constants/community.ts is used exactly as before.
 *
 * Everything goes through SOGS's own HTTP API, authenticated as a global admin (SOGS_ADMIN_SEED, the
 * account the community moderation tests already use). Nothing here needs shell or Docker access to
 * the machine running SOGS, which is what lets CI — a different host from the devnet — use it.
 *
 * State here is module-level, which is per-worker (Playwright workers are separate processes) and
 * therefore safe: tests within a worker run one at a time.
 */

/**
 * Marks a room as this suite's to delete.
 *
 * SOGS has no notion of a temporary room, so the rule is ours and is enforced here, on every path
 * that deletes: a room whose token doesn't start with this is not something a test created, and a bug
 * that pointed a delete at one would take out a long-lived room. Asserting it in one place is cheap
 * next to that.
 */
export const DISPOSABLE_PREFIX = 'qa-';

type SogsTarget = {
  admin: SogsIdentity;
  base: string;
  serverPubkey: Uint8Array;
};

let target: SogsTarget | undefined;

/**
 * Where to reach SOGS and who to be, derived once per process from the environment.
 *
 * Both halves come from configuration the suite already has: the origin and the server's public key
 * out of COMMUNITY_LINK (the same link the tests hand to the app), and the admin account out of
 * SOGS_ADMIN_SEED. Nothing further needs setting to turn per-test rooms on.
 *
 * Not derived once in `probePerTestRooms` and shared: workers are separate processes and inherit the
 * environment, not module state, so each derives this for itself.
 */
function sogsTarget(): SogsTarget {
  if (target) {
    return target;
  }

  const link = process.env.COMMUNITY_LINK;
  if (!link) {
    throw new Error('COMMUNITY_LINK is unset, so there is no SOGS to create rooms on');
  }
  const recoveryPhrase = process.env.SOGS_ADMIN_SEED;
  if (!recoveryPhrase) {
    throw new Error(
      'SOGS_ADMIN_SEED is unset. Creating and deleting rooms requires a global admin on the ' +
        "SOGS; set it to the recovery phrase of one (locally, the account in the sogs container's " +
        'SOGS_ADMIN_SESSION_IDS — see Sesh-Net-Docker/sogs/docker-compose.yml)'
    );
  }

  const url = new URL(link);
  const publicKey = url.searchParams.get('public_key');
  if (!publicKey || !/^[0-9a-fA-F]{64}$/.test(publicKey)) {
    throw new Error(`COMMUNITY_LINK has no valid public_key parameter: ${link}`);
  }

  target = {
    admin: identityFromRecoveryPhrase(recoveryPhrase),
    base: `${url.protocol}//${url.host}`,
    serverPubkey: new Uint8Array(Buffer.from(publicKey, 'hex')),
  };
  return target;
}

/** A signed request to SOGS as the admin account. */
async function asAdmin(method: 'DELETE' | 'GET' | 'POST', path: string, body?: unknown) {
  const { admin, base, serverPubkey } = sogsTarget();
  return sogsRequest({ base, body, identity: admin, method, path, serverPubkey });
}

/** Rooms on the server, with the creation time gc needs. Requires the admin to be a global admin. */
type RoomListing = { created: number; token: string };

async function listRooms(): Promise<Array<RoomListing>> {
  const response = await asAdmin('GET', '/rooms');
  if (response.status === 401) {
    throw new Error(
      `SOGS rejected our authentication (${describeFailure(response)}). This is a signing or key ` +
        `problem rather than a permissions one — check SOGS_ADMIN_SEED is a valid recovery phrase`
    );
  }
  if (response.status === 403) {
    throw new Error(
      `the SOGS_ADMIN_SEED account is not a global admin on ${sogsTarget().base}, so it cannot ` +
        `create or delete rooms (${describeFailure(response)})`
    );
  }
  if (response.status !== 200) {
    throw new Error(`could not list rooms on ${sogsTarget().base} (${describeFailure(response)})`);
  }
  return response.body as Array<RoomListing>;
}

/**
 * Create a room and post the first message to it.
 *
 * The message is not optional: `joinCommunity` waits for one, so a client joining an empty room hangs
 * rather than failing (see sogs_seed_message.ts). SOGS creates rooms empty and has no opinion about
 * it, so seeding belongs to whoever creates the room — us.
 */
async function createRoom(token: string, name: string): Promise<void> {
  const created = await asAdmin('POST', '/rooms', { description: null, name, token });
  if (created.status === 404 || created.status === 405) {
    throw new Error(
      `this SOGS has no room creation endpoint (${describeFailure(created)}). POST /rooms and ` +
        `DELETE /room/<token> were added in session-pysogs; the server needs to be new enough to ` +
        `have them`
    );
  }
  if (created.status !== 201) {
    throw new Error(`could not create room "${token}" (${describeFailure(created)})`);
  }

  const { identity, request } = buildSeedMessage(token, name, sogsTarget().serverPubkey);
  const { base, serverPubkey } = sogsTarget();
  const seeded = await sogsRequest({
    base,
    body: request,
    identity,
    method: 'POST',
    path: `/room/${token}/message`,
    serverPubkey,
  });
  if (seeded.status !== 201) {
    throw new Error(
      `created room "${token}" but could not post its first message ` +
        `(${describeFailure(seeded)}); a client joining it would hang, so treating this as fatal`
    );
  }
}

/** Delete a room. A room that has already gone is the normal outcome of a retried teardown. */
async function deleteRoom(token: string): Promise<void> {
  if (!token.startsWith(DISPOSABLE_PREFIX)) {
    throw new Error(
      `refusing to delete room "${token}": only rooms prefixed "${DISPOSABLE_PREFIX}" are this ` +
        `suite's to remove`
    );
  }
  const response = await asAdmin('DELETE', `/room/${token}`);
  if (response.status !== 200 && response.status !== 404) {
    throw new Error(`could not delete room "${token}" (${describeFailure(response)})`);
  }
}

let allocated: CommunityRoom[] = [];
let allocationCounter = 0;

/**
 * Carries the decision from global-setup to the workers.
 *
 * An env var rather than a module-level boolean because **Playwright runs each worker in its own
 * process**: `probePerTestRooms` runs once in the main process during global setup, and a variable set
 * there would simply not exist in any worker. Workers inherit the environment of the process that
 * spawned them, so this is the channel that crosses the boundary — the same mechanism QA_RUN_ID uses.
 */
const ENABLED_FLAG = 'PER_TEST_COMMUNITY_ROOMS';

/**
 * Whether this run allocates its own rooms.
 *
 * A cheap read of a decision made once by `probePerTestRooms` — deliberately not a check. Every
 * `getCommunities()` call asks this, so it must not touch the filesystem or the network, and every
 * caller must agree: a test that allocated rooms alongside a `getCommunities()` call that decided
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
 * Listing rooms is the check because it exercises everything creating one needs — SOGS reachable, our
 * request signing accepted, and the account a global admin — and it is the one admin-only read that
 * changes nothing. A cheaper check that only proved SOGS was up would pass here and fail on the first
 * allocation instead, which is a much worse place to find out.
 *
 * An unusable server falls back to the shared rooms rather than failing the run, since that
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
    await listRooms();
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
  console.log(`Per-test community rooms enabled (on ${sogsTarget().base})`);
  return true;
}

/**
 * Token for a room, unique across concurrent runs and workers.
 *
 * QA_RUN_ID is stamped once per run in global-setup; without it two runs starting together could
 * pick the same token and delete each other's rooms.
 */
function nextToken(): string {
  const runId = process.env.QA_RUN_ID ?? 'local';
  const worker = process.env.TEST_PARALLEL_INDEX ?? '0';
  allocationCounter += 1;
  return `${DISPOSABLE_PREFIX}${runId}-w${worker}-${allocationCounter}`;
}

/**
 * The link a client joins the room with. Built from COMMUNITY_LINK's origin and public_key rather
 * than the server's own idea of its address, which is localhost and unreachable from a simulator.
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
    await createRoom(token, name);
    rooms.push({ link: linkForToken(token), name, roomName: token });
  }
  // A copy: `rooms` *is* the module's record of what to clean up, so handing it out directly would let
  // a caller drop rooms from it and leak them.
  return [...rooms];
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
      await deleteRoom(room.roomName);
    } catch (e) {
      console.warn(
        `Failed to delete community room "${room.roomName}" (gc will collect it): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }
}

/** A copy, for the same reason `allocateCommunityRooms` returns one. */
export function getAllocatedRooms(): Array<CommunityRoom> {
  return [...allocated];
}

/**
 * Remove rooms orphaned by runs that were killed before teardown.
 *
 * Which rooms those are is decided here rather than by the server: SOGS reports every room's token
 * and creation time, and what counts as disposable is this suite's rule, not something SOGS knows
 * about. The TTL is what stops this deleting a room out from under a test that is still running — a
 * concurrent run's rooms are indistinguishable from an abandoned one's — so it must comfortably
 * exceed the longest single test.
 */
export async function gcCommunityRooms(olderThanSeconds: number = 3_600): Promise<void> {
  if (!perTestRoomsEnabled()) {
    return;
  }

  try {
    const cutoff = Date.now() / 1_000 - olderThanSeconds;
    const disposable = (await listRooms()).filter(room => room.token.startsWith(DISPOSABLE_PREFIX));
    const stale = disposable.filter(room => room.created <= cutoff);

    for (const room of stale) {
      await deleteRoom(room.token);
    }
    console.log(
      `gc: removed ${stale.length} room(s), left ${disposable.length - stale.length} inside the ` +
        `${olderThanSeconds}s TTL.`
    );
  } catch (e) {
    console.warn(
      `Community room gc failed (continuing): ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
