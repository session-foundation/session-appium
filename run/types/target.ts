/**
 * The two axes a test run targets. Both were previously duplicated across modules
 * (`IosServiceNetwork` in capabilities_ios + `NetworkClass` in devnet;
 * `WorkersPlatform` in binaries + `ClientPlatform` in devnet), so they live here instead.
 *
 * Deliberately a dependency-free leaf module: it is imported by `playwright.config.ts`,
 * `capabilities_ios.ts` and `devnet.ts`, none of which should pull in a runtime module chain
 * just to name a union.
 */

/** A platform this suite can drive a client on. */
export type ClientPlatform = 'android' | 'desktop' | 'ios';

/**
 * A Session network a client (or the seeder) can be pointed at. Note each platform selects one
 * differently — see `resolveNetworkTargets` in `run/test/utils/devnet.ts`.
 */
export type ServiceNetwork = 'devnet' | 'mainnet' | 'testnet';
