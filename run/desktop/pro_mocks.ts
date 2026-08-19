import type { ProMockContext } from '../test/utils/pro_context';

/**
 * Desktop's half of the shared Pro mock vocabulary, extending `ProMockContext` as `IOSTestContext`
 * does so the two shared fields mean the same thing in a Desktop spec as in a `bothPlatformsIt` one.
 *
 * Display-level only: these produce no proof, so they cover screens, copy and CTAs and never
 * anything another party has to verify. See `makeAccountPro` for that.
 */
export type DesktopProContext = ProMockContext & {
  /**
   * Remaining access, as one of libsession's ISO8601 duration slugs. Named rather than numeric: the
   * app's enum renumbers whenever a case is inserted.
   */
  proAccessExpiry?:
    | 'P24DT1M'
    | 'P29D'
    | 'P300D'
    | 'P30D'
    | 'P30DT1S'
    | 'P365D'
    | 'P7D'
    | 'P90D'
    | 'PT10S'
    | 'PT1M'
    | 'PT23H59M'
    | 'PT24H1M'
    | 'PT33M';
  /**
   * Whether the plan renews itself. Defaults to **false**, which is what makes `active` mean the same
   * thing on all three clients. Left true, Desktop renders `proAutoRenewTime` where the other two
   * render `proExpiringTime`.
   */
  autoRenewing?: boolean;
};

/**
 * Every variable this module owns, listed once so the reset cannot drift from the writes. A mock left
 * set leaks into every later test in the same worker and reads as a product bug there.
 */
const PRO_ENV_KEYS = [
  'SESSION_PRO',
  'SESSION_PRO_CURRENT_STATUS',
  'SESSION_PRO_MOCK_PROOF',
  'SESSION_PRO_ACCESS_EXPIRY',
  'SESSION_USER_HAS_PRO_CANCELLED',
  'SESSION_PRO_BACKEND_LOADING',
  'SESSION_PRO_BACKEND_ERROR',
  'SESSION_PRO_BACKEND_SUCCESS',
] as const;

/**
 * `SESSION_PRO` as the run was configured, captured before any test overrides it. Alone among these
 * keys it predates per-test mocking — specs still read it to decide whether Pro is on offer at all,
 * so clearing it between tests would silently flip their assertions.
 */
const AMBIENT_SESSION_PRO = process.env.SESSION_PRO;

/**
 * Translate a spec's requested Pro state into the launch environment, clearing anything not asked for.
 *
 * The app reads most of these with `!isEmpty(...)`, so `'0'` still enables them — absence is the only
 * "off", hence deleting rather than assigning an empty value.
 */
export function applyProMocks(context?: DesktopProContext) {
  PRO_ENV_KEYS.forEach(key => delete process.env[key]);
  if (!context) {
    if (AMBIENT_SESSION_PRO !== undefined) {
      process.env.SESSION_PRO = AMBIENT_SESSION_PRO;
    }
    return;
  }

  // `proAvailable` gates every Pro surface ahead of any status check, so a status mock alone renders
  // nothing. Implied rather than per-spec because forgetting it gives an empty screen, not an error.
  process.env.SESSION_PRO = '1';

  if (context.proBackendStatus) {
    process.env.SESSION_PRO_CURRENT_STATUS =
      context.proBackendStatus === 'useActual' ? 'useactual' : context.proBackendStatus;
  }
  if (context.proAccessExpiry) {
    process.env.SESSION_PRO_ACCESS_EXPIRY = context.proAccessExpiry;
  }
  // The ACCESS half. `SESSION_PRO_CURRENT_STATUS` above says what state the plan is in and grants
  // nothing, so a fixture wanting an ordinary Pro user sets both — the pair is only interesting when
  // they disagree.
  //
  // The lowercasing is LOAD-BEARING, not tidiness: Desktop's value vocabulary is lowercase and it
  // *throws at flag-init* on anything else, so passing the contract's `useActual` through verbatim
  // stops the renderer starting rather than failing a test. Deliberately fixed here rather than by
  // making the app tolerate both cases — one layer owns per-platform translation (the status field
  // above does the same), and two layers each half-tolerating leaves nobody able to say which is
  // responsible.
  if (context.proProof) {
    process.env.SESSION_PRO_MOCK_PROOF =
      context.proProof === 'useActual' ? 'useactual' : context.proProof;
  }
  // Only for a mocked-active plan: that is the case where `active` has to mean the same thing on all
  // three clients. Forcing it for an unmocked context would mock away part of a real grant.
  if (
    context.autoRenewing === false ||
    (context.proBackendStatus === 'active' && !context.autoRenewing)
  ) {
    process.env.SESSION_USER_HAS_PRO_CANCELLED = '1';
  }
  if (context.proLoadingState === 'loading') {
    process.env.SESSION_PRO_BACKEND_LOADING = '1';
  }
  if (context.proLoadingState === 'error') {
    process.env.SESSION_PRO_BACKEND_ERROR = '1';
  }
  // Reaches the expiry CTAs with no backend: the arming decision is made from a *fetched* response, so
  // a status mock alone never gets as far as making it. This runs the real `handleExpiryCTAs` over the
  // mocked values instead, and suppresses the startup fetch so a genuine answer cannot overwrite it.
  if (context.proLoadingState === 'success') {
    process.env.SESSION_PRO_BACKEND_SUCCESS = '1';
  }

  console.info(
    `   Pro mocks: ${PRO_ENV_KEYS.filter(key => process.env[key])
      .map(key => `${key}=${process.env[key]}`)
      .join(' ')}`
  );
}
