import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ConversationType, DISAPPEARING_TIMES, MergedOptions } from '../../types/testing';
import { ConversationSettings } from '../locators/conversation';
import {
  DisappearingMessageRadial,
  DisappearingMessagesMenuOption,
  DisappearingMessagesSubtitle,
  DisappearingMessagesTimerType,
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
  await device.clickOnElementAll(new ConversationSettings(device));
  // Wait for UI to load conversation options menu
  await sleepFor(500);
  await device.clickOnElementAll(new DisappearingMessagesMenuOption(device));
  if (enforcedType === '1:1') {
    await device.clickOnElementAll(new DisappearingMessagesTimerType(device, timerType));
  }
  if (timerType === 'Disappear after read option') {
    if (enforcedType === '1:1') {
      await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.TWELVE_HOURS);
    } else {
      await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.ONE_DAY);
    }
  } else if (
    enforcedType === 'Group' ||
    (enforcedType === 'Note to Self' && timerType === 'Disappear after send option')
  ) {
    await device.onIOS().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_IOS);
    await device.onAndroid().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_ANDROID);
  } else {
    await device.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.ONE_DAY);
  }

  await device.clickOnElementAll(new DisappearingMessageRadial(device, timerDuration));
  await device.clickOnElementAll(new SetDisappearMessagesButton(device));
  await device.navigateBack();
  // Extended the wait for the Follow settings button to settle in the UI, it was moving and confusing appium
  await sleepFor(2000);
  if (device2) {
    await device2.clickOnElementAll(new FollowSettingsButton(device2));
    await sleepFor(500);
    await device2.clickOnElementAll(new SetModalButton(device2));
  }
  await device.waitForTextElementToBePresent(new DisappearingMessagesSubtitle(device));
};
