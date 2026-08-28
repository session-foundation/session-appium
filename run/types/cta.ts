import { tStripped } from '../localizer/lib';

export type CTAType =
  | 'alreadyActivated'
  | 'animatedProfilePicture'
  | 'donate'
  | 'longerMessages'
  | 'pinnedConversations'
  | 'pinnedConversationsOverLimit'
  | 'pinnedConversationsRenew'
  | 'proExpired'
  | 'proExpiringSoon';

/**
 * How a CTA is closed.
 *
 * `closeButton` is the dialog's "X", exposed only by its content description ("Close" on Android,
 * "Close button" on iOS) and the only way out of a CTA with no negative button, such as the donation
 * appeal. `negativeButton` is the CTA's own Cancel. `scrim` taps outside the dialog at (150,150) and
 * does not close every CTA: the Pro modals ignore it on iOS, and the next tap then lands on the scrim
 * rather than the control it aimed at, so the failure surfaces somewhere unrelated.
 */
export type CTADismissal = 'closeButton' | 'negativeButton' | 'scrim';

export type CTAConfig = {
  heading: string;
  /**
   * Omitted where the copy interpolates data the table cannot know — the expiring-soon body carries
   * the remaining time, which differs per platform fixture. A spec that cares asserts it itself.
   */
  body?: string;
  negativeButton?: string;
  positiveButton?: string;
  features?: string[];
};

/** Shared by every pinned-conversation CTA; they differ only in their heading and body. */
const PIN_CTA_FEATURES = [
  tStripped('proFeatureListPinnedConversations'),
  tStripped('proFeatureListLongerMessages'),
  tStripped('proFeatureListLoadsMore'),
];

export const ctaConfigs: Record<CTAType, CTAConfig> = {
  donate: {
    heading: tStripped('ongoingAppeal'),
    body: tStripped('ongoingAppealDescription'),
    positiveButton: tStripped('readMoreCapital'),
  },
  longerMessages: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proCallToActionLongerMessages'),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('theContinue'),
    features: [
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
  animatedProfilePicture: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proAnimatedDisplayPictureCallToActionDescription'),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('theContinue'),
    features: [
      tStripped('proFeatureListAnimatedDisplayPicture'),
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
  alreadyActivated: {
    heading: tStripped('proActivated'),
    body: tStripped('proAnimatedDisplayPicture'),
    negativeButton: tStripped('close'),
  },
  // Shown on app open once a subscriber's Pro access has expired, on both platforms — not on opening
  // the Pro entry in settings. On Android it also blocks the route to settings until dismissed.
  proExpiringSoon: {
    heading: tStripped('proExpiringSoon'),
    negativeButton: tStripped('close'),
    positiveButton: tStripped('update'),
    features: [
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListAnimatedDisplayPicture'),
    ],
  },
  proExpired: {
    heading: tStripped('proExpired'),
    body: tStripped('proExpiredDescription'),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('renew'),
    features: [
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListAnimatedDisplayPicture'),
    ],
  },
  pinnedConversations: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proCallToActionPinnedConversationsMoreThan', { limit: '5' }),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('theContinue'),
    features: PIN_CTA_FEATURES,
  },
  /**
   * The same CTA raised by an account ALREADY holding more pins than the limit, which only a seeded
   * config can produce.
   *
   * A different token, not an oversight: the clients branch on it deliberately, and telling someone
   * holding six pins "want more than 5 pins?" would read as nonsense. Android picks between the two in
   * `ProComponents.kt`, crossed with whether the plan has expired.
   */
  pinnedConversationsOverLimit: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proCallToActionPinnedConversations'),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('theContinue'),
    features: PIN_CTA_FEATURES,
  },
  /**
   * The same CTA again for someone over the limit who PREVIOUSLY SUBSCRIBED, rather than never having.
   *
   * The clients pick the body from two axes — over the standard limit or not, previously subscribed or
   * not — so "the pinned conversations CTA" is four pieces of copy, not one. This is the cell reachable
   * by letting a real subscription end, and it is the only one that asks to renew rather than upgrade.
   */
  pinnedConversationsRenew: {
    heading: tStripped('renew'),
    body: tStripped('proRenewPinMoreConversations'),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('theContinue'),
    features: PIN_CTA_FEATURES,
  },
};
