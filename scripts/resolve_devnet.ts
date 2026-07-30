/**
 * Derives the `DEVNET_*` connection details from a running devnet instead of maintaining them by
 * hand as Actions variables / `.env` entries.
 *
 * Everything except the bootstrap address comes from one `get_service_nodes` call on the seed's
 * oxend RPC — the same call the seeder already makes:
 *
 *   DEVNET_PUBKEY    <- pubkey_ed25519
 *   DEVNET_IP        <- public_ip
 *   DEVNET_HTTP_PORT <- storage_port
 *   DEVNET_OMQ_PORT  <- storage_lmq_port
 *
 * Taking `public_ip` from the registry is the point, not a convenience: each snode advertises its
 * `LISTEN_IP` there and the client connects to whatever it finds, so reading the advertised value is
 * the only way these cannot drift out of step with what the client will actually be handed. It also
 * means the bootstrap address may be an mDNS name (`sesh-net.local`) even though the app itself
 * requires IPv4 — we resolve to the advertised IP before anything validates it.
 *
 * The storage ports are per-node (a 12-node devnet has twelve distinct pairs), so they cannot be
 * defaulted to constants; they have to be read for whichever node is chosen.
 *
 * Usage:
 *   npx ts-node scripts/resolve_devnet.ts                                  # sesh-net.local:1280
 *   npx ts-node scripts/resolve_devnet.ts --host 192.168.139.2             # explicit host
 *   npx ts-node scripts/resolve_devnet.ts --host x --rpc-port 1280         # explicit port
 *   npx ts-node scripts/resolve_devnet.ts --no-services                    # devnet only
 *
 * The devnet itself must resolve or this exits non-zero. The optional local file server and SOGS are
 * then attempted as best-effort optimisations: whichever is reachable is emitted, whichever is not is
 * warned about and omitted, leaving the harness on the production file server / remote community.
 *
 * Prints `KEY=value` lines on stdout (append to `$GITHUB_ENV`, or paste into `.env`); diagnostics go
 * to stderr so stdout stays machine-readable. Anything already set in the environment is preserved,
 * so an explicit variable still wins over autodetection.
 */

// Shared with the harness so the default and the parsing cannot drift apart — see
// run/shared/devnet_bootstrap.ts. That module is deliberately dependency-free, so importing it here
// does not pull dotenv in: this script must NOT see .env, since existing DEVNET_* values are treated
// as pins to preserve and would make it echo a stale config back instead of resolving a fresh one.
import {
  DEFAULT_DEVNET_BOOTSTRAP,
  DEFAULT_DEVNET_RPC_PORT,
  splitBootstrap,
} from '../run/shared/devnet_bootstrap';

const DEFAULT_HOST = DEFAULT_DEVNET_BOOTSTRAP;
const DEFAULT_RPC_PORT = DEFAULT_DEVNET_RPC_PORT;

/**
 * Defaults for the optional local file server and SOGS from the same Sesh-Net-Docker stack
 * (docs/local-devnet.md §4b/§4c).
 *
 * Only the *host* varies, and it is the devnet IP we already resolve — the compose runs
 * `network_mode: host`, so all three services share one address. Verified from inside a snode
 * container, which is the side that matters: the app reaches both over an onion request through the
 * snodes, so the URL has to resolve *there*, not on the machine running the tests. (This is also why
 * an mDNS `.local` name does not work for these two — containers have no mDNS resolver.)
 *
 * The two pubkeys are baked deterministic keys, so they are constants rather than something to
 * discover; neither service exposes its key over HTTP. Both were read from the running containers and
 * match `.env.sample`. Re-derive with:
 *   docker compose logs sogs       | grep -i 'server pubkey'
 *   docker compose logs fileserver | grep -i 'X25519 pubkey'
 * If the stack ever rotates them, override with the matching env var rather than editing these.
 */
const SERVICE_DEFAULTS = {
  /** X25519 — LibSession-Util consumes it directly as x25519; the ed25519 key will NOT work. */
  fileServerPubkey: '51bda59019c34e34c1dfcdf279b1c4e4da5cfc8c2cbb1e2942d443890ac8c43e',
  fileServerPort: '8000',
  /** X25519 server pubkey; this is what pins the community, independent of host. */
  sogsPubkey: 'aa7c2b3bcd6433e52d6616356fcdba68668e8b506d84a3c7a1a196d63235a613',
  sogsPort: '8080',
} as const;

type SogsRoom = {
  name?: string;
  token?: string;
};

type ServiceNodeState = {
  active?: boolean;
  pubkey_ed25519?: string;
  public_ip?: string;
  storage_lmq_port?: number;
  storage_port?: number;
};

/**
 * Treats an empty/whitespace value as absent. Actions exposes an unset `vars.X` as the empty string
 * rather than leaving it undefined, so `??` alone would accept `''` and defeat every default here.
 */
const envOr = (name: string, fallback: string): string => {
  const value = (process.env[name] ?? '').trim();
  return value === '' ? fallback : value;
};

function parseArgs(argv: string[]): { host: string; rpcPort: string; skipServices: boolean } {
  const bootstrap = envOr('DEVNET_BOOTSTRAP_HOST', DEFAULT_HOST);
  let host = bootstrap;
  let rpcPort = envOr('DEVNET_RPC_PORT', DEFAULT_RPC_PORT);
  // A port pinned explicitly (flag or env var) beats one embedded in the bootstrap address.
  let rpcPortExplicit = (process.env.DEVNET_RPC_PORT ?? '').trim() !== '';
  let skipServices = false;

  for (let i = 0; i < argv.length; i++) {
    const [flag, inlineValue] = argv[i].split('=');
    const value = inlineValue ?? argv[i + 1];
    if (flag === '--no-services') {
      skipServices = true;
    } else if (flag === '--host') {
      host = value ?? host;
      if (inlineValue === undefined) i++;
    } else if (flag === '--rpc-port') {
      rpcPort = value ?? rpcPort;
      rpcPortExplicit = true;
      if (inlineValue === undefined) i++;
    } else {
      console.error(`Unknown argument: "${argv[i]}"`);
      process.exit(1);
    }
  }

  const split = splitBootstrap(host);
  if (split.host === '') {
    console.error(`Empty devnet bootstrap address (got "${host}").`);
    process.exit(1);
  }
  return {
    host: split.host,
    rpcPort: rpcPortExplicit ? rpcPort : (split.port ?? rpcPort),
    skipServices,
  };
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Best-effort file server + SOGS values, keyed off the already-resolved devnet IP.
 *
 * Both are **optimisations, not requirements** (docs/local-devnet.md §4b/§4c): omitting their values
 * makes the harness fall back to the production file server and the remote community, which is a
 * working configuration — just a slower one. So a service that is absent is warned about and skipped
 * rather than failing the run, and the two are probed independently so one being down does not hide
 * the state of the other.
 *
 * Never exits: the caller has already resolved the devnet, which is the part that must succeed.
 */
async function resolveServices(ip: string): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  const sogsPort = envOr('SOGS_PORT', SERVICE_DEFAULTS.sogsPort);
  const fileServerPort = envOr('FILE_SERVER_PORT', SERVICE_DEFAULTS.fileServerPort);

  const sogsBase = `http://${ip}:${sogsPort}`;
  try {
    const response = await fetch(`${sogsBase}/rooms`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const rooms = (await response.json()) as SogsRoom[];
    if (!Array.isArray(rooms) || rooms.length === 0) {
      throw new Error('no rooms returned');
    }

    // The stack creates a primary room plus numbered siblings (…-2 … -6), and the primary is the
    // shortest token. Sorting rather than taking rooms[0] keeps the choice stable across calls, so a
    // room-specific problem cannot present as an intermittent one.
    const primary = rooms
      .filter(
        (r): r is Required<SogsRoom> => typeof r.token === 'string' && typeof r.name === 'string'
      )
      .sort((a, b) => a.token.length - b.token.length || a.token.localeCompare(b.token))[0];
    if (!primary) {
      throw new Error(`${rooms.length} room(s), none with a usable token/name`);
    }

    resolved.COMMUNITY_LINK = `${sogsBase}/${primary.token}?public_key=${envOr('SOGS_PUBKEY', SERVICE_DEFAULTS.sogsPubkey)}`;
    resolved.COMMUNITY_NAME = primary.name;
    resolved.COMMUNITY_ROOM = primary.token;
    console.error(`  SOGS         : ${sogsBase} — room "${primary.token}" of ${rooms.length}`);
  } catch (error) {
    console.error(
      `  SOGS         : unavailable at ${sogsBase} (${reason(error)})\n` +
        `                 -> community tests will use the remote community instead`
    );
  }

  // No health route — the root 404s when healthy — so "reachable" means the connection succeeded at
  // all, whatever the status.
  const fileServerUrl = `http://${ip}:${fileServerPort}`;
  try {
    await fetch(`${fileServerUrl}/`, { signal: AbortSignal.timeout(10_000) });
    resolved.FILE_SERVER_PUBKEY = envOr('FILE_SERVER_PUBKEY', SERVICE_DEFAULTS.fileServerPubkey);
    resolved.FILE_SERVER_URL = fileServerUrl;
    console.error(`  file server  : ${fileServerUrl}`);
  } catch (error) {
    console.error(
      `  file server  : unavailable at ${fileServerUrl} (${reason(error)})\n` +
        `                 -> media tests will use the production file server instead`
    );
  }

  return resolved;
}

const isIpv4 = (ip: string): boolean => {
  const octets = ip.split('.');
  return octets.length === 4 && octets.every(o => /^\d{1,3}$/.test(o) && Number(o) <= 255);
};

const isPort = (p: unknown): boolean =>
  typeof p === 'number' && Number.isInteger(p) && p > 0 && p <= 65535;

async function main(): Promise<void> {
  const { host, rpcPort, skipServices } = parseArgs(process.argv.slice(2));
  const url = `http://${host}:${rpcPort}/json_rpc`;
  console.error(`Resolving devnet details from ${url}`);

  let states: ServiceNodeState[];
  try {
    const response = await fetch(url, {
      body: JSON.stringify({ id: '0', jsonrpc: '2.0', method: 'get_service_nodes' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = (await response.json()) as { result?: { service_node_states?: unknown } };
    const raw = body.result?.service_node_states;
    if (!Array.isArray(raw)) {
      throw new Error('response had no result.service_node_states array');
    }
    states = raw as ServiceNodeState[];
  } catch (error) {
    console.error(
      `Could not reach the devnet seed at ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Only fully-usable nodes are candidates, and the choice is made deterministic by sorting on the
  // pubkey: an arbitrary "first active" would silently pick a different seed between runs, which
  // turns any seed-specific problem into an intermittent one.
  const candidates = states
    .filter(
      s =>
        s.active === true &&
        typeof s.pubkey_ed25519 === 'string' &&
        /^[0-9a-fA-F]{64}$/.test(s.pubkey_ed25519) &&
        typeof s.public_ip === 'string' &&
        isIpv4(s.public_ip) &&
        isPort(s.storage_port) &&
        isPort(s.storage_lmq_port)
    )
    .sort((a, b) => (a.pubkey_ed25519 ?? '').localeCompare(b.pubkey_ed25519 ?? ''));

  if (candidates.length === 0) {
    console.error(
      `No usable service node found (${states.length} returned, ` +
        `${states.filter(s => s.active).length} active). A devnet that is still coming up reports ` +
        `nodes without storage ports — retry once it has settled.`
    );
    process.exit(1);
  }

  const node = candidates[0];
  console.error(`Using seed ${node.pubkey_ed25519?.slice(0, 16)}… of ${candidates.length} usable`);

  const ip = String(node.public_ip);
  const resolved: Record<string, string> = {
    DEVNET_HTTP_PORT: String(node.storage_port),
    DEVNET_IP: ip,
    DEVNET_OMQ_PORT: String(node.storage_lmq_port),
    DEVNET_PUBKEY: String(node.pubkey_ed25519),
    DEVNET_RPC_PORT: rpcPort,
  };

  if (!skipServices) {
    // Keyed off the advertised IP, so the file server and SOGS are addressed the same way the snodes
    // address them — which is what the onion path requires. Best-effort: whatever is missing is
    // warned about and omitted, leaving the harness on its remote/production defaults.
    console.error('Optional local services:');
    Object.assign(resolved, await resolveServices(ip));
  }

  for (const [key, value] of Object.entries(resolved)) {
    const existing = (process.env[key] ?? '').trim();
    // An explicitly-set value wins, so a repo variable can still pin something deliberately.
    if (existing && key !== 'DEVNET_RPC_PORT') {
      console.error(`  ${key}: keeping existing value`);
      console.log(`${key}=${existing}`);
      continue;
    }
    console.log(`${key}=${value}`);
  }
}

void main();
