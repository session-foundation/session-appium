// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.

/** External link used by link-preview / URL-open tests on both platforms. */
export const testLink = 'https://getsession.org/';

/** Disappearing-message action (read-vs-sent) — identical on both platforms. */
export type DisappearActions = 'read' | 'sent';

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
   * The route offered while the store's own quick-refund window is open. A Session-owned short link
   * which redirects to the store, so the CTA beside it names the store while this url does not.
   */
  quickRefund: 'getsession.org/android-refund',
  /**
   * The route offered once that window has closed and only Session can action the request — its Pro
   * support form.
   */
  sessionProSupportForm: 'getsession.org/pro-support',
} as const;
