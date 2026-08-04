import { getDevnetSeedUrl, getServiceNetwork } from './network_target';

/**
 * Android's equivalent of the iOS `appium:processArguments.env` launch variables.
 *
 * Android apps cannot read the launcher's environment, so the same settings travel as intent extras
 * on the launch activity. Appium appends `appium:optionalIntentArguments` to the `am start` it issues,
 * and `QaLaunchConfig` in Session_Android reads them — on QA/debug builds only, gated by the
 * `ALLOW_QA_LAUNCH_CONFIG` build flag (the launcher is an exported activity-alias, so acting on
 * extras in a release build would let any installed app repoint the network).
 *
 * Returns `undefined` unless NETWORK_TARGET is explicitly set. That is important for compatibility:
 * an `automaticQa` APK already defaults to devnet via `BuildConfig.DEFAULT_ENVIRONMENT`, so sending
 * `sessionServiceNetwork=mainnet` by default would *override* that and quietly move every existing
 * Android devnet run onto mainnet.
 */
export function buildAndroidLaunchExtras(): string | undefined {
  if (!(process.env.NETWORK_TARGET ?? '').trim()) {
    return undefined;
  }

  const network = getServiceNetwork();
  const extras = [`--es sessionServiceNetwork ${network}`];

  if (network === 'devnet') {
    // Android only needs the seed URL: unlike iOS it discovers the snode pool itself, so it needs
    // neither the pubkey nor the storage ports.
    extras.push(`--es sessionDevnetSeedUrl ${getDevnetSeedUrl()}`);
  }

  return extras.join(' ');
}
