/**
 * The two axes a test run targets. Both unions had drifted into per-module copies (one in
 * `capabilities_ios.ts` and another in `devnet.ts`; one in `binaries.ts` and another in
 * `devnet.ts`), so they are defined once here and imported everywhere else.
 *
 * Deliberately a dependency-free leaf module: it is imported by `playwright.config.ts`,
 * `binaries.ts`, `capabilities_ios.ts` and `devnet.ts`, none of which should have to pull in a
 * runtime module chain just to name a union.
 */

/** A platform this suite can drive a client on. */
export type ClientPlatform = 'android' | 'desktop' | 'ios';

/**
 * A Session network a client (or the seeder) can be pointed at. Note each platform selects one
 * differently — see `resolveNetworkTargets` in `run/test/utils/devnet.ts`.
 */
export type ServiceNetwork = 'devnet' | 'mainnet' | 'testnet';
