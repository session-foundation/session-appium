import { tStripped } from '../localizer/lib';

export type CTAType =
  | 'alreadyActivated'
  | 'animatedProfilePicture'
  | 'donate'
  | 'longerMessages'
  | 'pinnedConversations'
  | 'proExpired';

export type CTAConfig = {
  heading: string;
  body: string;
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
    features: [
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
};
