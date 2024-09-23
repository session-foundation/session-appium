import { localize } from '../../localizer/i18n/localizedString';
import { androidIt, iosIt } from '../../types/sessionIt';
import {
  DMTimeOption,
  DisappearActions,
  DisappearModes,
  DisappearingControlMessage,
} from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

iosIt('Disappear after send', disappearAfterSend);
androidIt('Disappear after send', disappearAfterSend);

async function disappearAfterSend(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, 'Alice', platform),
    newUser(device2, 'Bob', platform),
  ]);
  const mode: DisappearModes = 'send';
  const testMessage = `Checking disappear after ${mode} is working`;
  const controlMode: DisappearActions = 'sent';
  const time: DMTimeOption = '30 seconds';
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // Select disappearing messages option
  await setDisappearingMessage(
    platform,
    device1,
    ['1:1', `Disappear after ${mode} option`, time],
    device2
  );
  // Get control message based on key from json file
  await checkDisappearingControlMessage(
    platform,
    userA,
    userB,
    device1,
    device2,
    time,
    controlMode
  );
  // Send message to verify that deletion is working
  await device1.sendMessage(testMessage);
  await device2.clickOnElementByText({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  // Wait for message to disappear
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
