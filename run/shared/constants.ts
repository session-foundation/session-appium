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
