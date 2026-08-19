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
