/**
 * The devnet seed node's address — the one piece of devnet config that is not discoverable, since it
 * is what you bootstrap *from*. Everything else is read off the seed's `get_service_nodes` RPC (see
 * `scripts/resolve_devnet.ts`).
 *
 * Deliberately dependency-free, including no `dotenv`. It is imported both by the harness (where
 * `playwright.config.ts` has already loaded `.env`) and by `scripts/resolve_devnet.ts`, which must
 * *not* see `.env`: existing `DEVNET_*` values there are treated as pins to preserve, so loading them
 * would make the script echo a stale config back instead of resolving a fresh one.
 */

/**
 * Was `sesh-net.local`, which stopped resolving. mDNS across the runner's network is not dependable,
 * and it never resolved from inside the snode containers at all — so it cannot be used for the file
 * server or SOGS either, which the app reaches through the snodes.
 *
 * Overridable per run by the `DEVNET_BOOTSTRAP` workflow input on both regression workflows, which
 * arrives here as `DEVNET_BOOTSTRAP_HOST`.
 */
export const DEFAULT_DEVNET_BOOTSTRAP = '192.168.1.114:1280';

/** Fallback RPC port when the bootstrap address carries no `:port`. */
export const DEFAULT_DEVNET_RPC_PORT = '1280';

/**
 * Splits a bootstrap address into host and optional port.
 *
 * The address is surfaced as a single editable field, so it has to tolerate what people actually
 * paste: a bare host, `host:port`, or a full URL. Getting this wrong fails silently rather than
 * loudly — a scheme left on the front turns into `http://http://host:1280/json_rpc`.
 */
export function splitBootstrap(value: string): { host: string; port?: string } {
  const bare = value
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') // scheme
    .replace(/\/.*$/, ''); // path
  const match = /^(.*):(\d{1,5})$/.exec(bare);
  return match ? { host: match[1], port: match[2] } : { host: bare };
}

/** Treats empty/whitespace as absent — an unset Actions `vars.X` arrives as the empty string. */
const envOr = (name: string, fallback: string): string => {
  const value = (process.env[name] ?? '').trim();
  return value === '' ? fallback : value;
};

/**
 * The devnet seed node's base URL, e.g. `http://192.168.1.114:1280`.
 *
 * Resolved on every call rather than captured in a module-level constant: `run/constants/index.ts`
 * does not load `.env`, so a value frozen at import time would depend on which module happened to
 * call `dotenv.config()` first.
 *
 * An explicit `DEVNET_RPC_PORT` beats a port embedded in the bootstrap address.
 *
 * Returns the `http://${string}` template type rather than plain `string` so it still satisfies the
 * seeder's network parameter (`'mainnet' | 'testnet' | \`http${string}\``), which the previous
 * hardcoded constant satisfied by virtue of being a literal.
 */
export function getDevnetBootstrapUrl(): `http://${string}` {
  const { host, port } = splitBootstrap(envOr('DEVNET_BOOTSTRAP_HOST', DEFAULT_DEVNET_BOOTSTRAP));
  const explicitPort = (process.env.DEVNET_RPC_PORT ?? '').trim();
  return `http://${host}:${explicitPort || port || DEFAULT_DEVNET_RPC_PORT}`;
}
