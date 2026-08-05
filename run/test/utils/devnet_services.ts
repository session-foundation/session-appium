import { randomBytes } from 'crypto';

import { DISPOSABLE_PREFIX } from './community_rooms';
import { describeFailure, identityFromSeed, sogsRequest } from './sogs_auth';

/**
 * The optional local services that live on the devnet's host: the SOGS the community tests use, the
 * file server the media tests upload to (docs/local-devnet.md §4b/§4c), and the Pro backend.
 *
 * The first two are **optimisations, not requirements**. Leaving them unset puts the suite on the
 * remote community and the production file server, which is a working configuration — just a slower
 * one. So nothing here ever fails a run: a service that is absent, or that we cannot prove we would
 * talk to correctly, is warned about and skipped.
 *
 * The Pro backend is the exception to that framing, and `discoverProBackend` says why: there is no
 * usable fallback for it, so a run that asked for it and did not get one is warned about loudly.
 *
 * ## Why discover them at all
 *
 * Their addresses embed the devnet host, which differs per environment and moves whenever the devnet
 * does. That is exactly the hand-maintained-and-therefore-stale configuration that devnet discovery
 * (`network_target.ts`) already removed for the `DEVNET_*` values, and the failure it produced was the
 * same: a value that still *looks* valid, pointing at something that is no longer there.
 *
 * ## Why the devnet's advertised IP is the host
 *
 * The app reaches both services over an onion request **through the snodes**, so their URLs have to
 * resolve from inside the snode containers rather than from the machine running the tests. The
 * advertised service-node IP satisfies both, which is why it is the default here — and why an mDNS
 * `.local` name cannot be (containers have no mDNS resolver).
 *
 * `SOGS_HOST` / `FILE_SERVER_HOST` override it for the case where a service does not in fact share the
 * devnet's address — most likely on CI, where the runner, the devnet and these services need not be
 * the same box.
 */

/**
 * Defaults for the Sesh-Net-Docker stack. Ports are its published ones; the SOGS pubkey is the
 * deterministic key its container generates, which no HTTP route exposes — so it is a constant here
 * rather than something to discover.
 *
 * Both are overridable, and a different deployment (CI's, say) is expected to need that. A wrong
 * pubkey is caught rather than trusted — see `discoverSogs`.
 */
const SERVICE_DEFAULTS = {
  fileServerPort: '8000',
  proBackendPort: '8090',
  sogsPort: '8080',
  sogsPubkey: 'aa7c2b3bcd6433e52d6616356fcdba68668e8b506d84a3c7a1a196d63235a613',
} as const;

/**
 * A POST-only route on the Pro backend, used as an identity probe.
 *
 * A GET returns `405` when the route exists, where the root returns a plain `404` — so this
 * distinguishes "the Pro backend is here" from "something else holds the port", which a liveness
 * check on `/` cannot. Worth having because, unlike SOGS, nothing here can verify the backend's keys
 * (see `discoverProBackend`), making the address the only thing we *can* check.
 */
const PRO_BACKEND_PROBE_PATH = '/get_pro_revocations';

/** The room `buildLocalCommunities` falls back to when SOGS has no non-disposable room to offer. */
const CONVENTIONAL_ROOM = { name: 'Local Devnet Community', token: 'local-devnet-community' };

const HEX64 = /^[0-9a-fA-F]{64}$/;

const envValue = (name: string): string => (process.env[name] ?? '').trim();

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A room as SOGS lists it, before we have checked anything about it. */
type SogsRoomListing = { name?: unknown; token?: unknown };

type DiscoveredRoom = { name: string; token: string };

/**
 * The room whose token goes into `COMMUNITY_LINK`.
 *
 * Only used when per-test rooms are off: with them on, `community_rooms.ts` creates its own rooms and
 * reads nothing from the link but its origin and `public_key`. So this exists for the fallback path,
 * and picks the room that path expects — the primary one, which is the shortest token (the stack
 * creates `<primary>`, `<primary>-2` … `<primary>-6`).
 *
 * Disposable rooms are excluded: they belong to a run that is either still going or was killed before
 * its teardown, and the gc sweep will delete them out from under us.
 *
 * Sorted rather than "first match" so the choice is stable across calls — an unstable one would turn
 * any room-specific problem into an intermittent one.
 */
function pickFallbackRoom(rooms: Array<SogsRoomListing>): DiscoveredRoom | undefined {
  return rooms
    .filter(
      (room): room is DiscoveredRoom =>
        typeof room.token === 'string' &&
        room.token !== '' &&
        typeof room.name === 'string' &&
        !room.token.startsWith(DISPOSABLE_PREFIX)
    )
    .sort((a, b) => a.token.length - b.token.length || a.token.localeCompare(b.token))[0];
}

/**
 * Find the local SOGS and publish `COMMUNITY_LINK` for it.
 *
 * One signed `GET /rooms` does all three jobs: it proves the server is reachable, that it is really a
 * SOGS rather than whatever else might hold the port, and — because SOGS signatures are computed over
 * the server's public key — that the pubkey we are about to put in the link is the right one. A wrong
 * key cannot produce a valid signature, so it comes back 401.
 *
 * That last check is the reason this is more than a port probe. Publishing an unverified link would be
 * worse than publishing nothing: `probePerTestRooms` would fail its own authentication, quietly turn
 * per-test rooms off, and hand the community specs a local link they cannot use — where leaving
 * `COMMUNITY_LINK` unset keeps them on the remote community and passing.
 *
 * The identity is ephemeral and unprivileged. Nothing here needs `SOGS_ADMIN_SEED`: signing proves the
 * pubkey regardless of who signs, and listing rooms is a read any account can make.
 */
async function discoverSogs(host: string): Promise<Array<string>> {
  const label = '  SOGS        :';
  if (envValue('COMMUNITY_LINK')) {
    return [`${label} COMMUNITY_LINK is already set — leaving it alone`];
  }

  const base = `http://${envValue('SOGS_HOST') || host}:${envValue('SOGS_PORT') || SERVICE_DEFAULTS.sogsPort}`;
  const pubkey = (envValue('SOGS_PUBKEY') || SERVICE_DEFAULTS.sogsPubkey).toLowerCase();
  if (!HEX64.test(pubkey)) {
    return [
      `${label} SOGS_PUBKEY is not a 64-character hex string ("${pubkey}") — skipping`,
      `               -> community tests will use the remote community`,
    ];
  }

  let response;
  try {
    response = await sogsRequest({
      base,
      identity: identityFromSeed(new Uint8Array(randomBytes(32))),
      method: 'GET',
      path: '/rooms',
      serverPubkey: new Uint8Array(Buffer.from(pubkey, 'hex')),
      timeoutMs: 10_000,
    });
  } catch (error) {
    return [
      `${label} unavailable at ${base} (${reason(error)})`,
      `               -> community tests will use the remote community`,
    ];
  }

  if (response.status === 401) {
    return [
      `${label} ${base} rejected our signature (${describeFailure(response)}), which means the`,
      `               server pubkey we would have put in COMMUNITY_LINK is not this server's.`,
      `               Set SOGS_PUBKEY to its actual X25519 server pubkey (\`docker compose logs`,
      `               sogs | grep -i 'server pubkey'\`) — the built-in default is the local stack's.`,
      `               -> community tests will use the remote community`,
    ];
  }
  if (response.status !== 200 || !Array.isArray(response.body)) {
    return [
      `${label} ${base} is not answering as a SOGS (${describeFailure(response)})`,
      `               -> community tests will use the remote community`,
    ];
  }

  const log = [];
  const room = pickFallbackRoom(response.body as Array<SogsRoomListing>);
  if (!room) {
    // Fine for per-test rooms, which create their own; only the fallback path needs a room that
    // exists, and it is the one that would be left without one.
    log.push(
      `${label} ${base} has no permanent room, using "${CONVENTIONAL_ROOM.token}" in the link`,
      `               -> harmless with per-test rooms on; without them there is nothing to join`
    );
  }

  const { name, token } = room ?? CONVENTIONAL_ROOM;
  process.env.COMMUNITY_LINK = `${base}/${token}?public_key=${pubkey}`;
  process.env.COMMUNITY_NAME = name;
  process.env.COMMUNITY_ROOM = token;

  log.push(
    `${label} ${base} — verified, ${response.body.length} room(s), link room "${token}"`,
    `               (pubkey from ${envValue('SOGS_PUBKEY') ? 'SOGS_PUBKEY' : 'the built-in default'})`
  );
  return log;
}

/**
 * Find the local file server and publish `FILE_SERVER_URL` for it.
 *
 * Unlike SOGS there is no way to check the pubkey from here: it is only used to encrypt the *inside*
 * of an onion request, so nothing this side of the snodes can tell a right key from a wrong one, and
 * a wrong one surfaces as uploads failing with `Failed to decrypt onion request` mid-run.
 *
 * So the key has to be stated rather than assumed: with `FILE_SERVER_PUBKEY` unset we report the
 * server we found and leave the suite on the production file server, which works. Guessing would
 * trade a slower run for a broken one.
 */
async function discoverFileServer(host: string): Promise<Array<string>> {
  const label = '  file server :';
  if (envValue('FILE_SERVER_URL')) {
    return [`${label} FILE_SERVER_URL is already set — leaving it alone`];
  }

  const url = `http://${envValue('FILE_SERVER_HOST') || host}:${envValue('FILE_SERVER_PORT') || SERVICE_DEFAULTS.fileServerPort}`;
  try {
    // Any answer counts: the root 404s when the server is healthy, so this asks whether something is
    // there rather than whether it liked the request.
    //
    // The body is cancelled rather than ignored: undici keeps the socket checked out of its
    // connection pool until the body is consumed or collected, so dropping it leaks a connection to a
    // service we are probably not going to talk to again. GET rather than HEAD because the probe only
    // needs *something* to answer, and a server that serves GET can still answer HEAD differently.
    const response = await fetch(`${url}/`, { signal: AbortSignal.timeout(5_000) });
    await response.body?.cancel();
  } catch (error) {
    return [
      `${label} unavailable at ${url} (${reason(error)})`,
      `               -> media tests will use the production file server`,
    ];
  }

  const pubkey = envValue('FILE_SERVER_PUBKEY');
  if (!pubkey) {
    return [
      `${label} reachable at ${url}, but FILE_SERVER_PUBKEY is unset`,
      `               Set it to the server's X25519 pubkey (\`docker compose logs fileserver |`,
      `               grep -i pubkey\`) to use it. It cannot be checked from here — a wrong key`,
      `               fails at onion-decrypt time, mid-run — so it is not guessed.`,
      `               -> media tests will use the production file server`,
    ];
  }
  if (!HEX64.test(pubkey)) {
    return [
      `${label} FILE_SERVER_PUBKEY is not a 64-character hex string ("${pubkey}") — skipping`,
      `               -> media tests will use the production file server`,
    ];
  }

  process.env.FILE_SERVER_URL = url;
  return [`${label} ${url} — using FILE_SERVER_PUBKEY ${pubkey.slice(0, 8)}…`];
}

/**
 * Find the local Pro backend and publish the dev-target values the clients read.
 *
 * Only the address is discovered. The signing key cannot be: no route returns it (checked against the
 * running instance and the backend's own route table), and unlike the SOGS and file-server keys it is
 * not a baked deterministic value — the container generates a keypair into its data volume, so it
 * differs per instance. Hence `TEST_PRO_BACKEND_ED_PK`, from the startup banner
 * (`docker logs sesh-net-pro-backend`).
 *
 * One key, not two: the X25519 key the onion request encrypts to is derived from the Ed25519 one by
 * the client (see ProBackendTarget in session-desktop), because the backend prints two
 * representations of a single keypair.
 *
 * The probe is an identity check rather than a liveness one — see `PRO_BACKEND_PROBE_PATH`.
 *
 * Skipped entirely when neither `TEST_PRO_BACKEND` nor a key is set, so an ordinary devnet run neither
 * pays for the probe nor reports a service it was never asked for.
 */
async function discoverProBackend(host: string): Promise<Array<string>> {
  const label = '  pro backend :';
  if (envValue('TEST_PRO_BACKEND_URL')) {
    return [`${label} TEST_PRO_BACKEND_URL is already set — leaving it alone`];
  }

  // `TEST_PRO_BACKEND` is the clients' on/off switch for the dev backend. Note ANY non-empty value
  // enables it there, `0` included.
  const requested = !!envValue('TEST_PRO_BACKEND');
  const edPk = envValue('TEST_PRO_BACKEND_ED_PK').toLowerCase();
  if (!requested && !edPk) {
    return [];
  }

  const url = `http://${envValue('PRO_BACKEND_HOST') || host}:${envValue('PRO_BACKEND_PORT') || SERVICE_DEFAULTS.proBackendPort}`;

  // A run that asked for the dev backend and does not get one is not a slower run, it is a broken one:
  // in session-desktop the unconfigured case throws inside SwarmPolling.pollOnceForKey, which kills
  // every poll cycle — messages send but never arrive. Worth shouting about here rather than leaving it
  // to be diagnosed from a test that times out waiting for a message.
  const unusable = (lines: Array<string>) =>
    requested
      ? [
          ...lines,
          `               !! TEST_PRO_BACKEND is set, so clients will FAIL rather than fall back:`,
          `                  Desktop throws on every swarm poll, so no message is ever received.`,
          `                  Unset TEST_PRO_BACKEND, or fix the above.`,
        ]
      : lines;

  try {
    const response = await fetch(`${url}${PRO_BACKEND_PROBE_PATH}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
    await response.body?.cancel();
    if (response.status === 404) {
      return unusable([
        `${label} something is at ${url} but it is not a Pro backend`,
        `               (${PRO_BACKEND_PROBE_PATH} returned 404 — a Pro backend answers 405 there)`,
      ]);
    }
  } catch (error) {
    return unusable([`${label} unavailable at ${url} (${reason(error)})`]);
  }

  if (!edPk) {
    return unusable([
      `${label} reachable at ${url}, but TEST_PRO_BACKEND_ED_PK is unset`,
      `               Set it to the "Ed25519 signing pubkey" from \`docker logs`,
      `               sesh-net-pro-backend\`. It is generated per instance, so unlike the SOGS and`,
      `               file-server keys there is no default to fall back on.`,
    ]);
  }
  if (!HEX64.test(edPk)) {
    return unusable([
      `${label} TEST_PRO_BACKEND_ED_PK is not a 64-character hex string ("${edPk}") — skipping`,
    ]);
  }

  process.env.TEST_PRO_BACKEND_URL = url;
  return [
    `${label} ${url} — using TEST_PRO_BACKEND_ED_PK ${edPk.slice(0, 8)}… (X25519 key derived from it)`,
    ...(requested ? [] : [`               note: set TEST_PRO_BACKEND to actually use it`]),
  ];
}

/**
 * Point the suite at the local SOGS and file server, if they are there.
 *
 * Called from `global-setup` once the devnet's own details are known, and **before**
 * `probePerTestRooms`, which reads the `COMMUNITY_LINK` this may set.
 *
 * Never throws: the devnet is the part that has to work, and it has already been verified by the time
 * this runs. Anything set explicitly is left alone, so a deliberate pin still wins.
 */
export async function resolveDevnetServices(devnetIp: string): Promise<void> {
  const [sogs, fileServer, proBackend] = await Promise.all([
    discoverSogs(devnetIp),
    discoverFileServer(devnetIp),
    discoverProBackend(devnetIp),
  ]);

  // Probed together but reported in a fixed order, so the log reads the same way every run.
  console.log('Optional local services (the run continues without them):');
  [...sogs, ...fileServer, ...proBackend].forEach(line => console.log(line));
}
