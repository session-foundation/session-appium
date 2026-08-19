/**
 * The Session Pro features a single message can be sent with, as the message-info screen lists them.
 *
 * This is the *per-message* set, which is not the same thing as the sender being Pro: the features
 * ride along in the message itself (a bitset — `SESSION_PROTOCOL_PRO_MESSAGE_FEATURES` for the
 * message, `..._PRO_PROFILE_FEATURES` for the profile), so a receiver can name exactly which ones a
 * given message used. That makes it the sharpest check available on the receiving side: the badge
 * elsewhere in the UI only says "this person is Pro", while this says "*this* message carried a valid
 * proof, and here is what it bought".
 *
 * The animated-display-picture feature exists too and is deliberately omitted — nothing here sets one.
 */
export type ProMessageFeature = 'increasedMessageLength' | 'proBadge';

/**
 * The test id every client tags this feature's row with on the message-info screen.
 *
 * The names are the **per-message subset of the shared Pro feature vocabulary** rather than a set of
 * their own: Desktop derives them with `Extract<ProFeatureItems, …>` from the list its Pro settings
 * screen already uses, Android names the same strings in `content-descriptions` and iOS in
 * `SessionProUI.AccessibilityIdentifier`. So one feature is called the same thing on every client and
 * on every screen — and renaming one means renaming it in four repos.
 *
 * Per feature rather than indexed, which is what lets an assertion name *which* features a message
 * carried instead of counting them.
 */
export type ProFeatureTestId = 'pro-message-feature-badges' | 'pro-message-feature-longer-messages';

export function proFeatureTestId(feature: ProMessageFeature): ProFeatureTestId {
  switch (feature) {
    case 'increasedMessageLength':
      return 'pro-message-feature-longer-messages';
    case 'proBadge':
      return 'pro-message-feature-badges';
  }
}
