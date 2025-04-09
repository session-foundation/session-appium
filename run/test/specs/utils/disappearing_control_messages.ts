import { englishStripped } from '../../../localizer/Localizer';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { DisappearActions, DISAPPEARING_TIMES, User } from '../../../types/testing';
import { SupportedPlatformsType } from './open_app';

export const checkDisappearingControlMessage = async (
  platform: SupportedPlatformsType,
  userA: User,
  userB: User,
  device1: DeviceWrapper,
  device2: DeviceWrapper,
  time: DISAPPEARING_TIMES,
  mode: DisappearActions,
  linkedDevice?: DeviceWrapper
) => {
  // Two control messages to check - You have set and other user has set
  // "disappearingMessagesSet": "<b>{name}</b> has set messages to disappear {time} after they have been {disappearing_messages_type}.",
  const disappearingMessagesSetUserA = englishStripped('disappearingMessagesSet')
    .withArgs({ name: userA.userName, time, disappearing_messages_type: mode })
    .toString();
  const disappearingMessagesSetUserB = englishStripped('disappearingMessagesSet')
    .withArgs({ name: userB.userName, time, disappearing_messages_type: mode })
    .toString();
  // "disappearingMessagesSetYou": "<b>You</b> set messages to disappear {time} after they have been {disappearing_messages_type}.",
  const disappearingMessagesSetYou = englishStripped('disappearingMessagesSetYou')
    .withArgs({ time, disappearing_messages_type: mode })
    .toString();
  // Check device 1
  if (platform === 'android') {
    await Promise.all([
      device1.disappearingControlMessage(disappearingMessagesSetYou),
      device1.disappearingControlMessage(disappearingMessagesSetUserB),
    ]);
    // Check device 2
    await Promise.all([
      device2.disappearingControlMessage(disappearingMessagesSetYou),
      device2.disappearingControlMessage(disappearingMessagesSetUserA),
    ]);
  }
  if (platform === 'ios') {
    await Promise.all([
      device1.disappearingControlMessage(disappearingMessagesSetYou),
      device2.disappearingControlMessage(disappearingMessagesSetUserA),
    ]);
  }
  // Check if control messages are syncing from both user A and user B
  if (linkedDevice) {
    await linkedDevice.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
    });
    await linkedDevice.disappearingControlMessage(disappearingMessagesSetYou);
    await linkedDevice.disappearingControlMessage(disappearingMessagesSetUserB);
  }
};
