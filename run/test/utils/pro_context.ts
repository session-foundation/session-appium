import { getProBackendOverride } from './pro_backend';

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
   * So a fixture that wants an ordinary Pro user sets BOTH. The clients model access and display as
   * separate values, and a combined lever alongside two separate ones would leave three knobs describing
   * two facts.
   *
   * `'none'` denies access **even on a device holding a real, valid proof** — it overrides rather than
   * falling back, since a mock a real proof could silently outvote would be useless on the devices most
   * worth running it on. `'useActual'`, and an absent field, leave the real proof to decide.
   *
   * Still not a real credential — see the module note above. This makes the client's own answer to
   * "may I" true; it does not produce anything another party can verify.
   */
  proProof?: 'none' | 'useActual' | 'valid';
  /**
   * Whether the mocked subscription has a refund pending. Both clients withdraw the same controls for it,
   * so one setup means the same thing on either.
   *
   * Only meaningful with `proBackendStatus: 'active'` — the flag lives on the active-plan shape.
   *
   * `'notRefunding'` FORCES no refund rather than deferring: the real state is a synced config flag any
   * of the user's other devices can have set.
   */
  proRefundingStatus?: 'notRefunding' | 'refunding' | 'useActual';
  /**
   * Whether the mocked plan renews itself.
   *
   * The flag the "Pro auto-renewing in {time}" line, the renewal-unsuccessful state and the Cancel Pro
   * Access action all read — so without it a mocked plan always runs to its end date and none of those
   * is reachable. Both clients otherwise take it from a `get_pro_status` response a mocked run never
   * receives.
   */
  proAutoRenewing?: 'autoRenewing' | 'notAutoRenewing' | 'useActual';
  /**
   * Whether the store's own quick-refund window is still open, which decides between the <48h and >48h
   * refund screens.
   *
   * **Only meaningful alongside `proOriginatingPlatform: 'android'`.** The window is a Google Play
   * concept: the backend gives a Play payment 48 hours, while an App Store payment gets its whole
   * subscription duration. On iOS the refund copy switch short-circuits for an Apple-originated plan
   * before the window is read, so setting this changes nothing there.
   *
   * The window is a property of the payment and a mocked fixture has none, so the real value is always
   * "closed" — the >48h screens are reachable without this, the <48h ones only with it.
   */
  proQuickRefundWindow?: 'closed' | 'open' | 'useActual';
  /**
   * Whether the store account signed in on this device is the one that bought the subscription.
   *
   * `'nonOriginatingAccount'` is what reaches the "you bought this on a different account" screens. On
   * Android this overrides `hasValidSubscription`, which the refund, cancel and choose-plan screens all
   * read — the refund screen only started consulting it once it was fixed to check the account as well as
   * the platform.
   */
  proOriginatingAccount?: 'nonOriginatingAccount' | 'originatingAccount' | 'useActual';
  /**
   * Which platform the subscription was bought on.
   *
   * Android reaches the same fact through the payment provider slug, which is what
   * `PaymentProviderMetadata.isFromAnotherPlatform` reads, so one setup means the same thing on both.
   */
  proOriginatingPlatform?: 'android' | 'iOS' | 'useActual';
  /**
   * Session Pro backend to use instead of the one compiled into libsession, so a QA backend can be
   * targeted without rebuilding.
   *
   * Set BOTH or neither: the pubkey is what libSession verifies proofs against, so a device given the QA
   * URL but left on the production key reads every QA-signed proof as invalid, strips the Pro content and
   * stores the sender as non-Pro — which reads as an app bug rather than a config mistake.
   *
   * Shared rather than per-platform because both clients consume it: iOS as the `customProBackendUrl` /
   * `customProBackendPubkey` launch variables, Android as the `sessionProBackendUrl` /
   * `sessionProBackendPubkey` intent extras.
   *
   * Normally supplied for every device by `PRO_BACKEND_CONTEXT` / the Android extras, from the environment.
   * Overriding it for ONE device is what lets a spec express a recipient that cannot verify a genuine
   * proof, which needs `MobileTestContexts` to differ per device.
   */
  proBackendUrl?: string;
  /** The backend's **Ed25519** signing key (`signing_pubkey` from its `GET /status`), not the x25519 form. */
  proBackendPubkey?: string;
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
 * The half of the mobile test context only Android reads, and the mirror of {@link IOSOnlyContext} — the
 * `android` prefix marks which side a field is currently on, and a field moves out of here the moment
 * iOS can consume it.
 */
export type AndroidOnlyContext = {
  /**
   * How the package manager should report this install to the app (Android).
   *
   * The in-app review prompt only lets the Path and Theme triggers raise it on a fresh install; when
   * updated, the Donate trigger is the only one that qualifies. The app derives that from
   * `firstInstallTime != lastUpdateTime`, and Appium installs over an existing package, so a test
   * device always reads as updated and those two triggers are unreachable without this.
   *
   * A state rather than iOS's install-date shape, and deliberately so: the comparison is against
   * `lastUpdateTime`, which the harness can neither read nor set, so a date could only ever produce
   * `updated` — the state that already happens by default. `useActual` restores the package manager's
   * own answer.
   *
   * Applying it also clears the stored review state, since that state is what the flag feeds. The reset
   * happens once, on the launch carrying the extra, so a spec asserting the prompt appears only once
   * still holds across a relaunch.
   */
  androidInstallState?: 'freshInstall' | 'updated' | 'useActual';

  /**
   * Whether the runtime notification permission is granted before the spec starts (Android).
   *
   * Granted by default, because Android raises the `POST_NOTIFICATIONS` prompt the first time the app
   * posts a notification — i.e. whenever a message happens to arrive — so left to itself it lands mid-
   * step and covers whatever the spec was doing.
   *
   * `'ask'` leaves it ungranted, for the specs whose SUBJECT is a permission flow: the calls specs
   * assert the app's own "notifications are required for calls" modal, which the app has no reason to
   * raise once the permission is already held. Those specs are testing the prompt, so the prompt has to
   * be reachable.
   */
  androidNotificationPermission?: 'ask' | 'granted';
};

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
  /**
   * Build variant, which decides whether billing UI is reachable at all (`ipa` has no billing).
   *
   * Android has the same notion but takes its variant from the build rather than a launch value, so this
   * one stays on the iOS side.
   */
  iosProBuildVariant?:
    | 'apk'
    | 'appStore'
    | 'development'
    | 'fDroid'
    | 'huawei'
    | 'ipa'
    | 'testFlight'
    | 'useActual';
};

/**
 * What both mobile platforms are handed. `openAppOnPlatform` forwards this whole object to
 * `openAndroidApp` as well as `openiOSApp`; Android reads the `ProContext` half as launch-intent extras
 * and ignores the rest.
 */
export type MobileTestContext = ProContext & IOSOnlyContext & AndroidOnlyContext;

/**
 * A context per device, or one context for all of them.
 *
 * A single context is the common case and stays the common case. An array exists for the fixtures where
 * the devices must DISAGREE — a sender whose Pro backend key the recipient does not trust, for instance,
 * which cannot be expressed while every device shares one context. Index matches device order, and a
 * `undefined` entry leaves that device unconfigured.
 */
export type MobileTestContexts = Array<MobileTestContext | undefined> | MobileTestContext;

/** The context for one device, whichever form the caller used. */
export function contextForDevice(
  contexts: MobileTestContexts | undefined,
  index: number
): MobileTestContext | undefined {
  return Array.isArray(contexts) ? contexts[index] : contexts;
}

/**
 * A device the app should treat as a fresh install (Android).
 *
 * The review prompt's Path and Theme triggers only qualify on a fresh install, and Appium always installs
 * over an existing package — so without this the app reads as updated and those two triggers can never
 * raise the prompt. iOS ignores the extra.
 *
 * Shared rather than redeclared per spec: five specs need exactly this and they must agree, since the
 * whole point is that the app's `firstInstallTime != lastUpdateTime` derivation is being overridden.
 */
export const FRESH_INSTALL_CONTEXT: MobileTestContext = { androidInstallState: 'freshInstall' };

/**
 * A device that has NOT been granted the notification permission (Android).
 *
 * The harness grants `POST_NOTIFICATIONS` up front everywhere else so Android's prompt cannot land
 * mid-step and cover whatever a spec was doing. The calls specs are the exception: they assert the app's
 * own "notifications are required for calls" modal, which the app has no reason to raise once the
 * permission is already held. There the prompt IS the subject, so it has to be reachable.
 */
export const CALLS_PERMISSION_CONTEXT: MobileTestContext = { androidNotificationPermission: 'ask' };

/**
 * Pro enabled, talking to the QA Pro backend when one is configured.
 *
 * The override belongs here rather than in individual specs because it must be on **every** device in a
 * test: the pubkey is what libSession verifies other users' proofs against, so a device left on the
 * default reads a QA-signed proof as invalid, strips the Pro content and stores the sender as non-Pro —
 * which looks like an app bug rather than a harness gap.
 */
export const PRO_BACKEND_CONTEXT: MobileTestContext = (() => {
  const proBackend = getProBackendOverride();
  return {
    ...(proBackend ? { proBackendUrl: proBackend.url, proBackendPubkey: proBackend.pubkey } : {}),
  };
})();

/**
 * Whole days of remaining Pro access granted by `activeProContext`.
 *
 * The app ceilings the remaining interval into day/hour/minute units, so an expiry exactly N days out
 * renders as `N days` for the whole first day — deterministic however long onboarding took.
 */
export const PRO_ACCESS_DAYS = 30;

/**
 * A current user who **is** a Pro subscriber, with no backend, no entitlement and no store involved.
 *
 * Use this for anything asserting how the UI *renders* Pro state. Only reach for `makeAccountPro`
 * when the assertion depends on something a real cryptographic proof produces — another device
 * verifying a badge, network-enforced limits, proof rotation — because a real grant costs a mint, an
 * app restart, and a race against the client's status-refresh cache.
 *
 * `proAccessExpiry` is not optional in practice: each mock defaults to "use the actual value", so an
 * `active` status on an account that never subscribed inherits a **zero** expiry and the app renders
 * an expiring-soon screen over the UI, which then fails later steps on missing elements.
 *
 * `proProof` is not optional either, and for a sharper reason: `proBackendStatus` says what state the
 * plan is in and **grants nothing**. Every feature — the character limit, the badge, the animated
 * avatar, the pinned limit — reads the proof, so a status-only fixture renders a subscriber whose
 * features are all switched off. Anything that means "this user is Pro" has to say both halves.
 */
export function activeProContext(days: number = PRO_ACCESS_DAYS): MobileTestContext {
  return {
    ...PRO_BACKEND_CONTEXT,
    proBackendStatus: 'active',
    proProof: 'valid',
    proAccessExpiry: String(Math.floor(Date.now() / 1000) + days * 24 * 60 * 60),
  };
}
