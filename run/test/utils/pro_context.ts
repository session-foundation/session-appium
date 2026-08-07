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
};
