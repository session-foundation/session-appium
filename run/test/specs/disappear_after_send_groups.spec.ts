import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt('Disappear after send groups', 'high', disappearAfterSendGroups);

async function disappearAfterSendGroups(platform: SupportedPlatformsType) {
  const testGroupName = 'Disappear after send test';
  const testMessage = 'Testing disappear after sent in groups';
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);

  await setDisappearingMessage(platform, device1, ['Group', `Disappear after send option`, time]);
  // Get correct control message for You setting disappearing messages
  const disappearingMessagesSetYou = englishStripped('disappearingMessagesSetYou')
    .withArgs({ time, disappearing_messages_type: controlMode })
    .toString();
  // Get correct control message for userA setting disappearing messages
  const disappearingMessagesSetControl = englishStripped('disappearingMessagesSet')
    .withArgs({ name: userA.userName, time, disappearing_messages_type: controlMode })
    .toString();
  // Check control message is correct on device 1, 2 and 3
  await Promise.all([
    device1.disappearingControlMessage(disappearingMessagesSetYou),
    device2.disappearingControlMessage(disappearingMessagesSetControl),
    device3.disappearingControlMessage(disappearingMessagesSetControl),
  ]);
  // Send message to verify deletion
  await device1.sendMessage(testMessage);
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
  ]);
  // Wait for 30 seconds
  await sleepFor(30000);
  // Check for test messages (should be deleted)
  await Promise.all([
    device1.hasTextElementBeenDeleted('Message body', testMessage),
    device2.hasTextElementBeenDeleted('Message body', testMessage),
    device3.hasTextElementBeenDeleted('Message body', testMessage),
  ]);
  // Close server and devices
  await closeApp(device1, device2, device3);
}
