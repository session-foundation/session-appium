// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.

/** External link used by link-preview / URL-open tests on both platforms. */
export const testLink = 'https://getsession.org/';

/** Disappearing-message action (read-vs-sent) — identical on both platforms. */
export type DisappearActions = 'read' | 'sent';

/**
 * A Session Account ID as the clients render it: `05` followed by 64 hex characters.
 *
 * One pattern, because it is checked in two places that cannot see each other — the mobile suite
 * harvests the ID from the settings screen, desktop reads it during onboarding — and a shape this
 * suite asserts against the app should not be able to drift between them.
 *
 * A guard rather than a bare regex so the `05${string}` narrowing is the compiler's conclusion:
 * both call sites previously re-asserted it with a cast right after testing the same pattern.
 */
const ACCOUNT_ID_REGEX = /^05[0-9a-f]{64}$/i;

export function isAccountId(value: string): value is `05${string}` {
  return ACCOUNT_ID_REGEX.test(value);
}

/** A long, multi-paragraph body used by "long message" / overflow tests on both platforms. */
export const longText =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum quis lacinia mi. Praesent fermentum vehicula rhoncus. Aliquam ac purus lobortis, convallis nisi quis, pulvinar elit. Nam commodo eros in molestie lobortis. Donec at mattis est. In tempor ex nec velit mattis, vitae feugiat augue maximus. Nullam risus libero, bibendum et enim et, viverra viverra est. Suspendisse potenti. Sed ut nibh in sem rhoncus suscipit. Etiam tristique leo sit amet ullamcorper dictum. Suspendisse sollicitudin, lectus et suscipit eleifend, libero dui ultricies neque, non elementum nulla orci bibendum lorem. Suspendisse potenti. Aenean a tellus imperdiet, iaculis metus quis, pretium diam. Nunc varius vitae enim vestibulum interdum. In hac habitasse platea dictumst. Donec auctor sem quis eleifend fermentum. Vestibulum neque nulla, maximus non arcu gravida, condimentum euismod turpis. Cras ac mattis orci. Quisque ac enim pharetra felis sodales eleifend. Aliquam erat volutpat. Donec sit amet mollis nibh, eget feugiat ipsum. Integer vestibulum purus ac suscipit egestas. Duis vitae aliquet ligula.';

// The product's own Pro limits, mirrored here because the suite has to assert the numbers the clients
// apply. Declared once for all three platforms: these were duplicated across ten spec files, which is
// how a limit change becomes a scattered edit that one spec quietly misses.
//
// A spec's own "how far past the limit do we poke" values are NOT these — those stay local to the spec,
// because they express what that test is doing rather than what the product allows.

/** Message character limit without Pro. */
export const STANDARD_MAX_CHARS = 2000;

/** Message character limit with Pro. */
export const PRO_MAX_CHARS = 10000;

/**
 * How far below whichever limit applies the composer's character countdown appears.
 *
 * Shared by both limits, so a countdown reading this exact value names which limit is in force only
 * when paired with the length that produced it.
 */
export const COUNTDOWN_START_THRESHOLD = 200;

/** Pinned conversations allowed without Pro. */
export const STANDARD_PIN_LIMIT = 5;

/**
 * How long to wait for a message to cross the network and render on the recipient.
 *
 * One value, shared, because these waits were previously picked per spec and had drifted to 90s on the Pro
 * ones — a number nobody had to defend.
 *
 * Sized for the SLOWEST legitimate case, which is a delivery arriving after the recipient has been
 * restarted: it has to reconnect and poll before it can receive, and that is much slower than the steady
 * state. Measured on Android, both directions: **20s fails, 60s passes.** Steady-state delivery is far
 * quicker — a desktop spec that onboards two seeded accounts, grants Pro, sends two 9,800-character
 * messages, restarts a client and asserts on both copies finishes in 14s end to end.
 *
 * So do not tune this down against a steady-state measurement; that is the mistake it already caused once.
 */
export const MESSAGE_DELIVERY_TIMEOUT_MS = 45_000;

/**
 * The refund destinations, as the FRAGMENT of each URL that names the route rather than the whole URL.
 *
 * Which URL the "Open URL" confirmation offers is what tells the refund routes apart: the same screen,
 * with the same title, sends the user either to the store's own refund workflow or to Session Support,
 * and only the URL says which. So this is the assertion — but a fragment rather than the full string,
 * for two reasons:
 *
 * 1. **The clients do not own these URLs.** All three read them from libsession's fixed per-provider
 *    table (`session/pro_backend.cpp`, `provider_urls()`), so the full string can change on a
 *    libsession bump with no client change at all — and a spec pinned to it would then fail against a
 *    correct app. What IS the clients' decision is *which of the provider's urls* a given state opens,
 *    and that is what the fragment captures.
 * 2. Two of them are third-party support-article ids (`9813244`, `118223`), which carry no meaning a
 *    reader of the spec can check.
 *
 * The fragments are still specific enough to distinguish every route: no two of the three share one.
 *
 * Substring matching is the caller's job — the mobile locators' `text`/`label` filters are exact after
 * normalisation, so the mobile helpers read the element's copy and assert `toContain`, while Desktop's
 * `:has-text()` selector is already a substring match.
 */
export const REFUND_URL_FRAGMENT = {
  /**
   * GOOGLE PLAY's quick-refund route, offered while that store's own refund window is open. A
   * Session-owned short link which redirects into the Play store, so the CTA beside it names the
   * store while this url does not.
   *
   * Two preconditions, BOTH required — this is not "the quick-refund url":
   *
   * 1. the plan's ORIGINATING provider is `google_play`, and
   * 2. that provider's quick-refund window is still open.
   *
   * An App Store plan in an open window takes {@link appleRefundSupport} instead, which is why this
   * one is named for its provider. The clients do not branch on the provider to achieve that: they
   * open `providerData.refundSupportUrl` from libsession's table for the ORIGINATING provider, and
   * the table already holds this short link under `google_play` and Apple's page under `app_store`.
   * Adding a provider check on top of the window would send an Apple plan to Session's form instead
   * of Apple's own page.
   */
  googlePlayQuickRefund: 'getsession.org/android-refund',
  /**
   * The route offered once that window has closed and only Session can action the request — its Pro
   * support form.
   */
  sessionProSupportForm: 'getsession.org/pro-support',
  /**
   * Apple's own refund page, which an App Store plan takes while its window is open. Apple's
   * `refund_platform_url` and `refund_support_url` are the same value, so this fragment says which
   * STORE the request went to and cannot say anything about the window.
   */
  appleRefundSupport: 'support.apple.com/118223',
} as const;
