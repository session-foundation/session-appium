import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, DisappearModes, USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt('Disappear after read', 'high', disappearAfterRead);

async function disappearAfterRead(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const testMessage = 'Checking disappear after read is working';
  const mode: DisappearModes = 'read';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // Click conversation options menu (three dots)
  await setDisappearingMessage(
    platform,
    device1,
    ['1:1', `Disappear after ${mode} option`, time],
    device2
  );
  // Check control message is correct on device 2
  await checkDisappearingControlMessage(platform, userA, userB, device1, device2, time, mode);
  // Send message to verify that deletion is working
  await device1.sendMessage(testMessage);
  // Need function to read message
  // Wait for 10 seconds
  await sleepFor(30000);
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
  ]);
  // Great success
  await closeApp(device1, device2);
}
