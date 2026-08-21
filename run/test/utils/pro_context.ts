/**
 * The mocked Pro state a spec asks for, in the vocabulary **both** platforms accept.
 *
 * Lives in its own module rather than alongside either platform's capabilities, because both consume
 * it and neither owns it: iOS passes these as `processArguments.env` launch variables, Android as
 * intent extras that `QaLaunchConfig` writes to the preferences its debug menu already drives. The
 * key names are the same on both sides deliberately, so one `bothPlatformsIt` setup means the same
 * thing everywhere.
 *
 * These mocks are **display-level**. They convince one client it is in a given Pro state but produce
 * no cryptographic proof, so they cover screens, copy and CTAs — never anything another party has to
 * verify. That needs a real grant; see the mock-vs-backend split.
 *
 * Typing the values as unions is deliberate: an unrecognised value is silently ignored by both apps,
 * which yields a passing *default-state* test rather than a failure, so a typo has to be caught here.
 */
export type ProMockContext = {
  /** Pro status the backend reports for the current user. */
  proBackendStatus?: 'active' | 'expired' | 'never' | 'useActual';
  /** Loading state of the Pro status request — reaches the loading and backend-unavailable screens. */
  proLoadingState?: 'error' | 'loading' | 'success' | 'useActual';
  /**
   * When the current user's access runs out, as unix SECONDS. Float-quantised inside the app, so
   * assert a range or a rendered string — never exact equality.
   *
   * PAIR THIS WITH `proBackendStatus: 'active'`. Each mock defaults to "use the actual value", so an
   * `active` status on an account that never subscribed inherits a zero expiry and the app renders
   * an expiring-soon screen — which then sits over the UI and fails later steps on missing elements.
   *
   * Shared rather than iOS-only because it is the field that decides which *shape* of active
   * subscriber a fixture is: both clients override the same value, so `active` plus an expiry two
   * days out is an about-to-lapse subscriber on either, without a per-platform token for the state.
   * Android also accepts a relative form (`+2d`); epoch seconds is used here because iOS takes only
   * that, and one representation for both is the point.
   */
  proAccessExpiry?: string;
  /**
   * Whether the client behaves as though it holds a usable Pro proof — the ACCESS half.
   *
   * `proBackendStatus` answers "what state is the plan in" and **does not grant access**. The two are
   * separate levers because the interesting bugs live where they disagree: a plan reading Active with
   * no proof behind it is the state in which a client offers the Pro character limit and every
   * recipient silently truncates what it sends.
   *
   * So a fixture that wants an ordinary Pro user sets BOTH. They were one lever until 2026-08-14, when
   * the clients split Pro into an access value and a display value; a combined lever alongside two
   * separate ones would have left three knobs describing two facts.
   *
   * `'none'` denies access **even on a device holding a real, valid proof** — it overrides rather than
   * falling back, since a mock a real proof could silently outvote would be useless on the devices most
   * worth running it on. `'useActual'`, and an absent field, leave the real proof to decide.
   *
   * Still not a real credential — see the module note above. This makes the client's own answer to
   * "may I" true; it does not produce anything another party can verify.
   */
  proProof?: 'none' | 'useActual' | 'valid';
};

/**
 * Test hooks that change a client's Pro **timing**, as opposed to mocking its Pro state.
 *
 * Deliberately not part of `ProMockContext`: everything there convinces one client it is in a state it
 * is not in, and produces nothing another party can verify. These do the opposite — they are used
 * alongside a REAL grant, and exist so a spec can observe behaviour the production schedule puts a day
 * out of reach.
 */
export type ProTestHookContext = {
  /**
   * Poll the Pro revocation list at launch instead of waiting out the server's cadence.
   *
   * Required by every revocation spec, not a convenience. Our QA backend serves `retry_in: 86400` —
   * the production cadence, and inside libSession's `[60s, 48h]` clamp, so nothing shortens it — which
   * puts a client's second poll a day after its first. Without this, no client learns of a revocation
   * within a test run, and a spec asserting enforcement passes only because nothing was ever enforced.
   *
   * The clients implement it by moving their own persisted "next poll" instant into the past, so the
   * production gate then decides to poll unmodified. That matters for what a spec proves: the path
   * exercised is the real one, not a test-only fetch that could pass while the real path is broken.
   */
  forceProRevocationRefresh?: boolean;
};

/** Everything a spec can ask of a client's Pro setup: the display mocks plus the timing hooks. */
export type ProContext = ProMockContext & ProTestHookContext;

/**
 * The half of the mobile test context only iOS reads.
 *
 * Kept beside `ProContext` rather than in `capabilities_ios` because the boundary between the two moves:
 * a field becomes shared the moment Android starts consuming it, and that should be a one-line move
 * between the types next to each other, not a cross-module refactor. The `ios` prefix marks which side a
 * field is currently on, so a mock that has only ever been wired on iOS is legible as such at the call
 * site — Android takes its Pro enablement and its backend from the AQA build variant instead.
 */
export type IOSOnlyContext = {
  iosCustomInstallTime?: string;
  iosSessionProEnabled?: string;
  /** Platform the subscription was originally purchased on. */
  iosProOriginatingPlatform?: 'android' | 'iOS' | 'useActual';
  /** Whether the store account matches the one that bought the subscription. */
  iosProOriginatingAccount?: 'nonOriginatingAccount' | 'originatingAccount' | 'useActual';
  /** Whether a refund has already been requested. */
  iosProRefundingStatus?: 'notRefunding' | 'refunding' | 'useActual';
  /** Build variant, which decides whether billing UI is reachable at all (`ipa` has no billing). */
  iosProBuildVariant?:
    | 'apk'
    | 'appStore'
    | 'development'
    | 'fDroid'
    | 'huawei'
    | 'ipa'
    | 'testFlight'
    | 'useActual';
  /**
   * Point the app at a QA Pro backend instead of the compiled-in production one.
   *
   * Set BOTH, and set them on EVERY device in a multi-device test: the pubkey is what libSession
   * verifies other users' proofs against, so a device left on the default reads a QA-signed proof as
   * invalid, strips the Pro content and stores the sender as non-Pro — which looks like an app bug
   * rather than a harness gap. `openAppTwoDevices`/`openAppThreeDevices` pass one context to every
   * device, so this holds as long as no per-device context is introduced.
   */
  iosProBackendUrl?: string;
  /** The backend's **Ed25519** signing key (`signing_pubkey` from its `GET /status`), not the x25519 form. */
  iosProBackendPubkey?: string;
};

/**
 * What both mobile platforms are handed. `openAppOnPlatform` forwards this whole object to
 * `openAndroidApp` as well as `openiOSApp`; Android reads the `ProContext` half as launch-intent extras
 * and ignores the rest.
 */
export type MobileTestContext = ProContext & IOSOnlyContext;

/**
 * A context per device, or one context for all of them.
 *
 * A single context is the common case and stays the common case. An array exists for the fixtures where
 * the devices must DISAGREE — a sender whose Pro backend key the recipient does not trust, for instance,
 * which cannot be expressed while every device shares one context. Index matches device order, and a
 * `undefined` entry leaves that device unconfigured.
 */
export type MobileTestContexts = MobileTestContext | Array<MobileTestContext | undefined>;

/** The context for one device, whichever form the caller used. */
export function contextForDevice(
  contexts: MobileTestContexts | undefined,
  index: number
): MobileTestContext | undefined {
  return Array.isArray(contexts) ? contexts[index] : contexts;
}
