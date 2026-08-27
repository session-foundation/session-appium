import { tStripped } from '../localizer/lib';

export type CTAType =
  | 'alreadyActivated'
  | 'animatedProfilePicture'
  | 'donate'
  | 'longerMessages'
  | 'pinnedConversations'
  | 'pinnedConversationsRenew'
  | 'proExpired'
  | 'proExpiringSoon';

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
  /**
   * The pinned-conversation CTA a LAPSED subscriber sees, as distinct from the one a standard user sees.
   *
   * The clients pick this body from two axes — whether the user is over the standard limit, and whether
   * they previously subscribed — so "the pinned conversations CTA" is four different pieces of copy, not
   * one. This is over-the-limit + previously-subscribed: the only cell reachable by letting a real
   * subscription end, and the one `pinnedConversations` below would silently mismatch.
   *
   * Note the body takes no `limit`: the standard-user copy names the number it is offering to raise,
   * and this one has nothing to name because the user already has more than it.
   */
  pinnedConversationsRenew: {
    heading: tStripped('renew'),
    body: tStripped('proRenewPinMoreConversations'),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('theContinue'),
    features: [
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
  pinnedConversations: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proCallToActionPinnedConversationsMoreThan', { limit: '5' }),
    negativeButton: tStripped('cancel'),
    positiveButton: tStripped('theContinue'),
    features: [
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
};
