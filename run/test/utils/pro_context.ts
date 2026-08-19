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
