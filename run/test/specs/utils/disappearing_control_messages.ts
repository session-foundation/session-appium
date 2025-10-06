import type { UserNameType } from '@session-foundation/qa-seeder';

import { englishStrippedStr } from '../../../localizer/englishStrippedStr';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { DisappearActions, DISAPPEARING_TIMES } from '../../../types/testing';
import { ConversationItem } from '../locators/home';
import { SupportedPlatformsType } from './open_app';

export const checkDisappearingControlMessage = async (
  platform: SupportedPlatformsType,
  userNameA: UserNameType,
  userNameB: UserNameType,
  device1: DeviceWrapper,
  device2: DeviceWrapper,
  time: DISAPPEARING_TIMES,
  mode: DisappearActions,
  linkedDevice?: DeviceWrapper
) => {
  // Two control messages to check - You have set and other user has set
  // "disappearingMessagesSet": "<b>{name}</b> has set messages to disappear {time} after they have been {disappearing_messages_type}.",
  const disappearingMessagesSetAlice = englishStrippedStr('disappearingMessagesSet')
    .withArgs({ name: userNameA, time, disappearing_messages_type: mode })
    .toString();
  const disappearingMessagesSetBob = englishStrippedStr('disappearingMessagesSet')
    .withArgs({ name: userNameB, time, disappearing_messages_type: mode })
    .toString();
  // "disappearingMessagesSetYou": "<b>You</b> set messages to disappear {time} after they have been {disappearing_messages_type}.",
  const disappearingMessagesSetYou = englishStrippedStr('disappearingMessagesSetYou')
    .withArgs({ time, disappearing_messages_type: mode })
    .toString();
  // Check device 1
  if (platform === 'android') {
    await Promise.all([
      device1.waitForControlMessageToBePresent(disappearingMessagesSetYou),
      device1.waitForControlMessageToBePresent(disappearingMessagesSetBob),
    ]);
    // Check device 2
    await Promise.all([
      device2.waitForControlMessageToBePresent(disappearingMessagesSetYou),
      device2.waitForControlMessageToBePresent(disappearingMessagesSetAlice),
    ]);
  }
  if (platform === 'ios') {
    await Promise.all([
      device1.waitForControlMessageToBePresent(disappearingMessagesSetYou),
      device2.waitForControlMessageToBePresent(disappearingMessagesSetAlice),
    ]);
  }
  // Check if control messages are syncing from both user A and user B
  if (linkedDevice) {
    await linkedDevice.clickOnElementAll(new ConversationItem(linkedDevice, userNameB));
    await linkedDevice.waitForControlMessageToBePresent(disappearingMessagesSetYou);
    await linkedDevice.waitForControlMessageToBePresent(disappearingMessagesSetBob);
  }
};
