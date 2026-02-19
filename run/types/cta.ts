import { tStripped } from '../localizer/lib';

export type CTAType = 'alreadyActivated' | 'animatedProfilePicture' | 'donate' | 'longerMessages';

/**
 * buttons[0] is the negative/dismiss button (always present);
 * buttons[1] is the optional positive/action button
 */
export type CTAConfig = {
  heading: string;
  body: string;
  buttons: [string, string] | [string];
  features?: string[];
};

export const ctaConfigs: Record<CTAType, CTAConfig> = {
  donate: {
    heading: tStripped('donateSessionHelp'),
    body: tStripped('donateSessionDescription'),
    buttons: [tStripped('maybeLater'), tStripped('donate')],
  },
  longerMessages: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proCallToActionLongerMessages'),
    buttons: [tStripped('cancel'), tStripped('theContinue')],
    features: [
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListPinnedConversations'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
  animatedProfilePicture: {
    heading: tStripped('upgradeTo'),
    body: tStripped('proAnimatedDisplayPictureCallToActionDescription'),
    buttons: [tStripped('cancel'), tStripped('theContinue')],
    features: [
      tStripped('proFeatureListAnimatedDisplayPicture'),
      tStripped('proFeatureListLongerMessages'),
      tStripped('proFeatureListLoadsMore'),
    ],
  },
  alreadyActivated: {
    heading: tStripped('proActivated'),
    body: tStripped('proAnimatedDisplayPicture'),
    buttons: [tStripped('close')],
  },
};
