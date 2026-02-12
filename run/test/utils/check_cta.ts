import { tStripped } from '../../../localizer/lib';

export type CTAType = 'animatedProfilePicture' | 'donate' | 'longerMessages';

export type CTAConfig = {
  heading: string;
  body: string;
  buttons: string[];
  features?: string[];
}

export const ctaConfigs: Record<CTAType, CTAConfig> = {
  donate: {
    heading: tStripped('donateSessionHelp'),
    body: tStripped('donateSessionDescription'),
    buttons: [tStripped('donate'), tStripped('maybeLater')],
  },
  longerMessages: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proCallToActionLongerMessages'),
    buttons: [tStripped('theContinue'), tStripped('cancel')],
    features: [
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
  animatedProfilePicture: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proAnimatedDisplayPictureCallToActionDescription'),
    buttons: [tStripped('theContinue'), tStripped('cancel')],
    features: [
      tStripped('proFeatureListAnimatedDisplayPicture'),
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
};
