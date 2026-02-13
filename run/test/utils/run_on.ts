import { SupportedPlatformsType } from './open_app';

export const runOnlyOnAndroid = async (
  platform: SupportedPlatformsType,
  toRun: () => Promise<any>
) => {
  if (platform === 'android') {
    await toRun();
  }
};

export const runOnlyOnIOS = async (platform: SupportedPlatformsType, toRun: () => Promise<any>) => {
  if (platform === 'ios') {
    await toRun();
  }
};
