import type { ProMockContext } from './pro_context';

import { getDevnetSeedUrl, getServiceNetwork } from './network_target';
import { getProBackendOverride } from './pro_backend';

/**
 * Android's equivalent of the iOS `appium:processArguments.env` launch variables.
 *
 * Android apps cannot read the launcher's environment, so the same settings travel as intent extras
 * on the launch activity. Appium appends `appium:optionalIntentArguments` to the `am start` it issues,
 * and `QaLaunchConfig` in Session_Android reads them — on QA/debug builds only, gated by the
 * `ALLOW_QA_LAUNCH_CONFIG` build flag (the launcher is an exported activity-alias, so acting on
 * extras in a release build would let any installed app repoint the network).
 *
 * The network extras are omitted unless NETWORK_TARGET is explicitly set. That is important for
 * compatibility: an `automaticQa` APK already defaults to devnet via `BuildConfig.DEFAULT_ENVIRONMENT`,
 * so sending `sessionServiceNetwork=mainnet` by default would *override* that and quietly move every
 * existing Android devnet run onto mainnet.
 *
 * **Two constraints on values, from `appium-adb`'s parser** (`buildStartCmd` →
 * `parseOptionalIntentArguments`): it splits on whitespace and treats any space-preceded `-`-prefixed
 * token as a new flag, so a value must contain **no spaces and no leading hyphen**. URLs, hex keys and
 * enum names are fine; a display string would not be.
 */
export function buildAndroidLaunchExtras(context?: ProMockContext): string | undefined {
  const extras: string[] = [];

  // The mocked Pro state, for specs asserting how Pro screens *render*. Named for the state being
  // simulated rather than the preference behind it, so a `bothPlatformsIt` spec has one setup that
  // means the same thing on both platforms — the values are the same vocabulary iOS accepts.
  if (context?.proBackendStatus) {
    extras.push(`--es sessionProBackendStatus ${context.proBackendStatus}`);
  }
  if (context?.proLoadingState) {
    extras.push(`--es sessionProLoadingState ${context.proLoadingState}`);
  }
  // Overrides `renewingAt` on an expiring subscriber, which is the field the home screen's
  // expiring-soon warning reads — so `active` plus a near expiry reaches that state without a
  // dedicated token. A token would also have to live in `sessionProBackendStatus`, whose value space
  // is the backend's own slugs and is deliberately open to future ones, so a test-only value there
  // could be shadowed by a real slug later and fail silently as "not subscribed".
  if (context?.proAccessExpiry) {
    extras.push(`--es sessionProAccessExpiry ${context.proAccessExpiry}`);
  }
  // The ACCESS half, deliberately separate from `sessionProBackendStatus` above: the status extra says
  // what state the plan is in and grants nothing on its own. Splitting them is what makes an
  // active-plan-with-no-proof client expressible, which is the state the silent-truncation bug lives in.
  if (context?.proProof) {
    extras.push(`--es sessionProProof ${context.proProof}`);
  }
  // Its own extra rather than a `sessionProBackendStatus` value, so it composes with any fixture — the
  // debug menu's `AUTO_APPLE_REFUNDING` hardwires a provider, duration and renewal date alongside it.
  if (context?.proRefundingStatus) {
    extras.push(`--es sessionProRefundingStatus ${context.proRefundingStatus}`);
  }
  // Android models renewing and expiring as different shapes rather than a flag, so the extra converts
  // between them — which is what keeps it composable with any fixture.
  if (context?.proAutoRenewing) {
    extras.push(`--es sessionProAutoRenewing ${context.proAutoRenewing}`);
  }
  // Android takes a boolean here rather than iOS's open/closed vocabulary, and `useActual` has to stay
  // distinct from `false` — one clears the override, the other forces the window shut.
  if (context?.proQuickRefundWindow) {
    const window =
      context.proQuickRefundWindow === 'useActual'
        ? 'useActual'
        : String(context.proQuickRefundWindow === 'open');
    extras.push(`--es sessionProQuickRefundWindow ${window}`);
  }
  if (context?.proOriginatingAccount) {
    extras.push(`--es sessionProOriginatingAccount ${context.proOriginatingAccount}`);
  }
  if (context?.proOriginatingPlatform) {
    extras.push(`--es sessionProOriginatingPlatform ${context.proOriginatingPlatform}`);
  }

  if ((process.env.NETWORK_TARGET ?? '').trim()) {
    const network = getServiceNetwork();
    extras.push(`--es sessionServiceNetwork ${network}`);

    if (network === 'devnet') {
      // Android only needs the seed URL: unlike iOS it discovers the snode pool itself, so it needs
      // neither the pubkey nor the storage ports.
      extras.push(`--es sessionDevnetSeedUrl ${getDevnetSeedUrl()}`);
    }
  }

  // Both or neither: the app rejects a half-supplied pair, because a QA URL paired with the production
  // signing key reads every QA-signed proof as invalid and silently strips Pro content.
  const proBackend = getProBackendOverride();
  if (proBackend) {
    extras.push(
      `--es sessionProBackendUrl ${proBackend.url}`,
      `--es sessionProBackendPubkey ${proBackend.pubkey}`
    );
  }

  return extras.length > 0 ? extras.join(' ') : undefined;
}

/**
 * Whether any launch extra was supplied, and so whether the app needs a relaunch to apply it.
 *
 * `QaLaunchConfig` persists the extras rather than applying them to the running process, so they only
 * take effect on the next launch.
 */
export function androidNeedsQaConfigRelaunch(context?: ProMockContext): boolean {
  return buildAndroidLaunchExtras(context) !== undefined;
}
