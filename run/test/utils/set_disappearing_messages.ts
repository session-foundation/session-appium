import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ConversationType, DISAPPEARING_TIMES, MergedOptions } from '../../types/testing';
import { ConversationSettings } from '../locators/conversation';
import {
  DisappearingMessageRadial,
  DisappearingMessagesMenuOption,
  DisappearingMessagesSubtitle,
  DisappearingMessagesTimerType,
  SetDisappearMessagesButton,
} from '../locators/disappearing_messages';

export const setDisappearingMessage = async (
  device: DeviceWrapper,
  [conversationType, timerType, timerDuration = DISAPPEARING_TIMES.THIRTY_SECONDS]: MergedOptions
) => {
  const enforcedType: ConversationType = conversationType;
  await device.clickAndWaitFor(
    new ConversationSettings(device),
    new DisappearingMessagesMenuOption(device)
  );
  await device.clickOnElementAll(new DisappearingMessagesMenuOption(device));
  if (enforcedType === '1:1') {
    await device.clickOnElementAll(new DisappearingMessagesTimerType(device, timerType));
  }
  await device.clickOnElementAll(new DisappearingMessageRadial(device, timerDuration));
  await device.clickOnElementAll(new SetDisappearMessagesButton(device));
  await device.navigateBack();
  await device.waitForTextElementToBePresent(new DisappearingMessagesSubtitle(device));
};
