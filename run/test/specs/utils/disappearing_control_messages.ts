import type { UserNameType } from '@session-foundation/qa-seeder';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { DisappearActions, DISAPPEARING_TIMES } from '../../../types/testing';
import { SupportedPlatformsType } from './open_app';
import { englishStrippedStr } from '../../../localizer/englishStrippedStr';

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
      device1.disappearingControlMessage(disappearingMessagesSetYou),
      device1.disappearingControlMessage(disappearingMessagesSetBob),
    ]);
    // Check device 2
    await Promise.all([
      device2.disappearingControlMessage(disappearingMessagesSetYou),
      device2.disappearingControlMessage(disappearingMessagesSetAlice),
    ]);
  }
  if (platform === 'ios') {
    await Promise.all([
      device1.disappearingControlMessage(disappearingMessagesSetYou),
      device2.disappearingControlMessage(disappearingMessagesSetAlice),
    ]);
  }
  // Check if control messages are syncing from both user A and user B
  if (linkedDevice) {
    await linkedDevice.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userNameB,
    });
    await linkedDevice.disappearingControlMessage(disappearingMessagesSetYou);
    await linkedDevice.disappearingControlMessage(disappearingMessagesSetBob);
  }
};
