import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { ConversationType, DISAPPEARING_TIMES, MergedOptions } from '../../../types/testing';
import {
  DisappearingMessagesMenuOption,
  FollowSettingsButton,
  SetDisappearMessagesButton,
  SetModalButton,
} from '../locators/disappearing_messages';
import { SupportedPlatformsType } from './open_app';
import { sleepFor } from './sleep_for';
export const setDisappearingMessage = async (
  platform: SupportedPlatformsType,
  device: DeviceWrapper,
  [conversationType, timerType, timerDuration = DISAPPEARING_TIMES.THIRTY_SECONDS]: MergedOptions,
  device2?: DeviceWrapper
) => {
  const enforcedType: ConversationType = conversationType;
  await device.clickOnByAccessibilityID('More options');
  // Wait for UI to load conversation options menu
  await sleepFor(500);
  await device.clickOnElementAll(new DisappearingMessagesMenuOption(device));
  if (enforcedType === '1:1') {
    await device.clickOnByAccessibilityID(timerType);
  }
  await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: DISAPPEARING_TIMES.ONE_DAY,
  });
  if (timerType === 'Disappear after read option') {
    if (enforcedType === '1:1' || enforcedType === 'Note to Self') {
      await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.TWELVE_HOURS);
    } else {
      await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.ONE_DAY);
    }
  } else if (enforcedType === 'Group' && timerType === 'Disappear after send option') {
    await device.onIOS().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_IOS);
    await device.onAndroid().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_ANDROID);
    // if (platform === 'ios') {
    //   await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_IOS);
    // } else {
    //   await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_ANDROID);
    // }
  } else {
    await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.ONE_DAY);
  }

  await device.clickOnElementAll({
    strategy: 'accessibility id',
    selector: timerDuration,
  });
  await device.clickOnElementAll(new SetDisappearMessagesButton(device));
  await device.onIOS().navigateBack();
  await sleepFor(1000);
  if (device2) {
    await device2.clickOnElementAll(new FollowSettingsButton(device2));
    await sleepFor(500);
    await device2.clickOnElementAll(new SetModalButton(device2));
  }
  // await device.waitForTextElementToBePresent(new DisappearingMessagesSubtitle(device));
};
