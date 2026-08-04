import net from 'net';

import type { ServiceNetwork } from '../../types/target';

/**
 * Which Session network this run targets, and — for devnet — the details discovered from its seed
 * node. The single place that answers "what are we pointed at", for every platform.
 *
 * ## Devnet auto-discovery
 *
 * Everything the clients need is derived from the ONE thing we configure: the seed node's oxend RPC
 * URL.
 *
 * ## Why derive instead of configure
 *
 * The iOS app needs four values to bootstrap onto a devnet (`devnetPubkey`, `devnetIp`,
 * `devnetHttpPort`, `devnetOmqPort`). Supplying those by hand made two whole classes of failure
 * possible, both of which present identically — a test that hangs until it times out — and both of
 * which hit iOS only, because Android and Desktop discover snodes from the seed URL themselves and
 * never use the pubkey or the storage ports:
 *
 *  - **Stale pubkey.** The devnet regenerates its seed keys on every `--build`/recreate (its compose
 *    mounts no volume for the data dir), so a hand-copied `DEVNET_PUBKEY` silently rots. It stays a
 *    valid 64-char hex string, so every validation still passes.
 *  - **Wrong storage ports.** `DEVNET_HTTP_PORT`/`DEVNET_OMQ_PORT` were consumed by nothing except
 *    the app, so no probe, seeder call or reachability check ever verified them.
 *
 * oxend already publishes all four values, and (verified on Sesh-Net-Docker, which uses host
 * networking) advertises host-published ports rather than container-internal ones. So we ask it.
 *
 * ## What we pick
 *
 * Any active, storage-reachable node works: these four values describe *a node to bootstrap from*,
 * not "the seed" specifically. Nodes on the same host as the seed URL are preferred so a run stays
 * on one box, but there is deliberately no port arithmetic to identify a particular node — that was
 * the fragile part of doing this by hand.
 */

/**
 * The network this run targets, from `NETWORK_TARGET` (default mainnet).
 *
 * Platform-neutral despite historically living in `capabilities_ios.ts` under the name
 * `getIosServiceNetwork`: iOS receives it as a launch argument, Android as a launch intent extra, and
 * Desktop through the seed URL the harness derives for it. One switch, three delivery mechanisms.
 */
export function getServiceNetwork(): ServiceNetwork {
  const raw = (process.env.NETWORK_TARGET ?? 'mainnet').trim().toLowerCase();
  if (raw === 'mainnet' || raw === 'testnet' || raw === 'devnet') {
    return raw;
  }
  throw new Error(
    `Invalid NETWORK_TARGET "${process.env.NETWORK_TARGET}". Use mainnet | testnet | devnet.`
  );
}

/**
 * Accepted `--network` values for `run_ios_parallel` (forwarded to the child as NETWORK_TARGET). Kept
 * in sync with `ServiceNetwork` via `satisfies`, so it cannot drift from what `getServiceNetwork`
 * accepts.
 */
export const ALLOWED_NETWORKS = [
  'mainnet',
  'testnet',
  'devnet',
] as const satisfies readonly ServiceNetwork[];

/** One devnet node, in the shape the iOS app's launch arguments expect. */
export type DevnetSeedNode = {
  /** ed25519 pubkey — the app's `devnetPubkey`. */
  pubkey: string;
  /** The app's `devnetIp`. */
  ip: string;
  /** oxend's `storage_port` — the app's `devnetHttpPort` (storage HTTPS). */
  httpPort: string;
  /** oxend's `storage_lmq_port` — the app's `devnetOmqPort` (storage OMQ/QUIC). */
  omqPort: string;
};

/** Outcome of asking a seed node for its service nodes. */
export type SeedProbeResult =
  | { usable: false; reason: string }
  | { usable: true; nodes: DevnetSeedNode[] };

/** Cached across the process; also mirrored into the environment (see `resolveDevnetSeedNode`). */
const RESOLVED_ENV_KEY = 'DETECTED_DEVNET_SEED_NODE';
let resolvedCache: DevnetSeedNode | undefined;

/**
 * The single devnet input: the seed node's oxend RPC URL.
 *
 * This is the ONLY devnet value that is configured. Everything the clients need — pubkey, IP and both
 * storage ports — is discovered from it, so there is deliberately no second way to express it.
 */
export function getDevnetSeedUrl(): `http://${string}` {
  const url = (process.env.DEVNET_SEED_URL ?? '').trim().replace(/\/$/, '');

  if (!url) {
    // If the retired pair is still set, show the exact replacement rather than making them work it out.
    const legacyIp = (process.env.DEVNET_IP ?? '').trim();
    const legacyPort = (process.env.DEVNET_RPC_PORT ?? '').trim();
    const hint =
      legacyIp && legacyPort
        ? `\nDEVNET_IP and DEVNET_RPC_PORT are no longer used — replace them with:\n  DEVNET_SEED_URL=http://${legacyIp}:${legacyPort}`
        : '';
    throw new Error(
      `Devnet requested but no seed node configured. Set DEVNET_SEED_URL=http://<host>:<rpcPort> ` +
        `(the seed node's oxend RPC endpoint).${hint}`
    );
  }

  if (!/^http:\/\/[^/\s]+$/.test(url)) {
    throw new Error(
      `DEVNET_SEED_URL must look like http://<host>:<port> (got "${url}"). ` +
        `It is the seed node's oxend RPC endpoint.`
    );
  }

  return url as `http://${string}`;
}

/** A single node as returned by oxend, before validation. */
type RawNodeState = {
  public_ip?: unknown;
  storage_port?: unknown;
  storage_lmq_port?: unknown;
  pubkey_ed25519?: unknown;
  storage_server_reachable?: unknown;
};

function isPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535;
}

function isIpv4(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const octets = value.split('.');
  return octets.length === 4 && octets.every(o => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

/**
 * Nodes usable as a bootstrap target: active (the query already filters), storage-reachable per
 * oxend's own tracking, and carrying a complete, well-formed set of the four values we need.
 */
function usableNodes(payload: unknown): DevnetSeedNode[] {
  const states = (payload as { result?: { service_node_states?: unknown } })?.result
    ?.service_node_states;
  if (!Array.isArray(states)) {
    return [];
  }

  return (states as RawNodeState[])
    .filter(n => n.storage_server_reachable === true)
    .filter(
      n =>
        typeof n.pubkey_ed25519 === 'string' &&
        /^[0-9a-fA-F]{64}$/.test(n.pubkey_ed25519) &&
        isIpv4(n.public_ip) &&
        isPort(n.storage_port) &&
        isPort(n.storage_lmq_port)
    )
    .map(n => ({
      pubkey: n.pubkey_ed25519 as string,
      ip: n.public_ip as string,
      httpPort: String(n.storage_port),
      omqPort: String(n.storage_lmq_port),
    }));
}

/** Can we open a TCP connection to host:port within `timeoutMs`? */
function canConnect(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Both storage ports must actually accept connections. oxend advertising host-published ports is an
 * observed property of this devnet layout, not a guarantee: a port-mapped devnet could advertise
 * container-internal ports, and silently handing the app unreachable ports would put us right back
 * to the hanging-test failure this discovery exists to remove. A plain TCP check is used rather than
 * an HTTP one because the OMQ port speaks QUIC/OMQ, not HTTP.
 */
async function portsReachable(node: DevnetSeedNode): Promise<boolean> {
  const [http, omq] = await Promise.all([
    canConnect(node.ip, Number(node.httpPort)),
    canConnect(node.ip, Number(node.omqPort)),
  ]);
  return http && omq;
}

/**
 * Ask the seed node for a usable bootstrap node and verify it, caching the result.
 *
 * Call this once from an async context early in the run (`global-setup`); the synchronous capability
 * builders then read the cache via `getResolvedDevnetSeedNode`. The result is mirrored into the
 * environment so Playwright's worker processes — which are spawned separately and inherit the
 * parent's env — don't each have to rediscover it.
 */
/**
 * Ask a seed node's oxend RPC for the service nodes it knows about.
 *
 * The single implementation of "is this devnet usable": one HTTP request, shared by devnet discovery
 * and by the pre-run gate in `devnet.ts`. It deliberately checks more than reachability, because a
 * bare liveness probe passes against things that then hang a test to its timeout — a 404, an unrelated
 * service on the port, or an oxend that has come up with an empty registry (routine on a
 * freshly-started devnet).
 *
 * Retries on CI, where a devnet may still be settling when the job starts.
 */
export async function probeSeedNode(url: string): Promise<SeedProbeResult> {
  const endpoint = `${url.replace(/\/$/, '')}/json_rpc`;
  const isCI = process.env.CI === '1';
  const maxAttempts = isCI ? 3 : 1;
  const timeoutMs = isCI ? 10_000 : 5_000;

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: '0',
    method: 'get_n_service_nodes',
    params: {
      active_only: true,
      limit: 50,
      fields: {
        public_ip: true,
        storage_port: true,
        storage_lmq_port: true,
        pubkey_ed25519: true,
        storage_server_reachable: true,
      },
    },
  });

  let lastReason = 'unknown error';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const states = (payload as { result?: { service_node_states?: unknown } })?.result
        ?.service_node_states;
      if (!Array.isArray(states)) {
        throw new Error('not an oxend RPC endpoint (no result.service_node_states in the reply)');
      }

      const nodes = usableNodes(payload);
      if (nodes.length === 0) {
        throw new Error(
          `oxend answered with ${states.length} active node(s), but none are usable as a bootstrap ` +
            `target (need one that is storage-reachable and advertises a pubkey, IP and both storage ports)`
        );
      }

      return { usable: true, nodes };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : 'unknown error';
      if (attempt < maxAttempts) {
        console.log(`Seed node ${url} attempt ${attempt}/${maxAttempts} failed: ${lastReason}`);
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  return { usable: false, reason: lastReason };
}

/**
 * Whether `url` is the configured seed node AND discovery has already validated it. Lets the pre-run
 * gate skip re-probing what discovery just checked far more thoroughly (it also verified the storage
 * ports), instead of making a second identical RPC call.
 */
export function seedNodeAlreadyVerified(url: string): boolean {
  return !!resolvedCache && url.replace(/\/$/, '') === getDevnetSeedUrl();
}

/**
 * Ask the seed node for a usable bootstrap node and verify it, caching the result.
 *
 * Call this once from an async context early in the run (`global-setup`); the synchronous capability
 * builders then read the cache via `getResolvedDevnetSeedNode`. The result is mirrored into the
 * environment so Playwright's worker processes — which are spawned separately and inherit the
 * parent's env — don't each have to rediscover it.
 */
export async function resolveDevnetSeedNode(): Promise<DevnetSeedNode> {
  if (resolvedCache) {
    return resolvedCache;
  }
  const fromEnv = process.env[RESOLVED_ENV_KEY];
  if (fromEnv) {
    resolvedCache = JSON.parse(fromEnv) as DevnetSeedNode;
    return resolvedCache;
  }

  const seedUrl = getDevnetSeedUrl();
  const probe = await probeSeedNode(seedUrl);

  if (!probe.usable) {
    throw new Error(
      `Could not use the devnet seed node's oxend RPC at ${seedUrl}/json_rpc: ${probe.reason}.\n` +
        `This is the endpoint the seeder uses and the one every devnet value is derived from.\n` +
        `Note oxend binds this RPC to a single address — the devnet host's LAN IP — while the storage ` +
        `ports bind all interfaces. So the storage ports can be reachable from here while this one is ` +
        `not, which means this machine has to be on the same LAN as the devnet.`
    );
  }

  // Prefer nodes on the same host as the seed URL, so a run stays on one box where possible.
  const seedHost = seedUrl.replace(/^http:\/\//, '').split(':')[0];
  const ordered = [
    ...probe.nodes.filter(n => n.ip === seedHost),
    ...probe.nodes.filter(n => n.ip !== seedHost),
  ];

  const tried: string[] = [];
  for (const node of ordered) {
    if (await portsReachable(node)) {
      console.log(
        `Devnet discovery: bootstrapping from ${node.ip} ` +
          `(https ${node.httpPort}, omq ${node.omqPort}, pubkey ${node.pubkey.slice(0, 8)}…) ` +
          `— ${probe.nodes.length} usable node(s) reported by ${seedUrl}`
      );
      warnOnObsoleteDevnetVars(node);
      resolvedCache = node;
      process.env[RESOLVED_ENV_KEY] = JSON.stringify(node);
      return node;
    }
    tried.push(`${node.ip}:${node.httpPort}/${node.omqPort}`);
  }

  throw new Error(
    `The devnet at ${seedUrl} reported ${probe.nodes.length} node(s), but none had both storage ` +
      `ports reachable from here. Tried: ${tried.join(', ')}.\n` +
      `Either those ports are firewalled, or this devnet advertises container-internal ports (in ` +
      `which case the advertised numbers cannot be used and the devnet's port publishing needs fixing).`
  );
}

/**
 * Warn about the hand-configured devnet variables this discovery replaced.
 *
 * All of them are inert now, but silence would be the wrong behaviour: a stale `DEVNET_PUBKEY` is the
 * single most likely reason an otherwise-correct devnet run used to fail on iOS *alone* (iOS needs the
 * pubkey to reach its bootstrap node; Android and Desktop discover snodes themselves and never use
 * it). Showing configured-vs-actual turns that into a one-line diagnosis.
 */
function warnOnObsoleteDevnetVars(node: DevnetSeedNode): void {
  const replaced: Array<[string, string | undefined, string | undefined]> = [
    ['DEVNET_PUBKEY', process.env.DEVNET_PUBKEY, node.pubkey],
    ['DEVNET_HTTP_PORT', process.env.DEVNET_HTTP_PORT, node.httpPort],
    ['DEVNET_OMQ_PORT', process.env.DEVNET_OMQ_PORT, node.omqPort],
    ['DEVNET_IP', process.env.DEVNET_IP, node.ip],
    // Superseded by DEVNET_SEED_URL rather than discovered, so there is nothing to compare against.
    ['DEVNET_RPC_PORT', process.env.DEVNET_RPC_PORT, undefined],
  ];

  const present = replaced.filter(([, configured]) => !!configured?.trim());
  if (present.length === 0) {
    return;
  }

  const lines = present.map(([name, configured, actual]) => {
    if (actual === undefined) {
      return `  - ${name}: superseded by DEVNET_SEED_URL`;
    }
    const configuredValue = configured!.trim();
    return configuredValue.toLowerCase() === actual.toLowerCase()
      ? `  - ${name}: matches the devnet, but is no longer read`
      : `  - ${name}: STALE — configured ${configuredValue}, actual ${actual}`;
  });

  console.warn(
    `Warning: these DEVNET_* variables are no longer used (the devnet is now queried for them) ` +
      `and can be deleted:\n${lines.join('\n')}`
  );
}

/**
 * The discovered node. Synchronous, for the capability builders — `resolveDevnetSeedNode` must have
 * run first (it does, from `global-setup`).
 */
export function getResolvedDevnetSeedNode(): DevnetSeedNode {
  if (resolvedCache) {
    return resolvedCache;
  }
  const fromEnv = process.env[RESOLVED_ENV_KEY];
  if (fromEnv) {
    resolvedCache = JSON.parse(fromEnv) as DevnetSeedNode;
    return resolvedCache;
  }
  throw new Error(
    'Devnet details were requested before discovery ran. resolveDevnetSeedNode() should have been ' +
      'called during global setup — is this running outside the Playwright runner?'
  );
}
