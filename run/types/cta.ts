import { tStripped } from '../localizer/lib';

export type CTAType =
  | 'alreadyActivated'
  | 'animatedProfilePicture'
  | 'donate'
  | 'longerMessages'
  | 'pinnedConversations'
  | 'pinnedConversationsOverLimit'
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

/** Shared by both pinned-conversation CTAs, which differ only in their body. */
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
};
