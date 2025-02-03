import { androidIt, iosIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

iosIt('Disappearing link message 1:1', 'low', disappearingLinkMessage1o1Ios);
androidIt('Disappearing link message 1:1', 'low', disappearingLinkMessage1o1Android);

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after read option';
const testLink = `https://getsession.org/`;

async function disappearingLinkMessage1o1Ios(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  // Send a link
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Sent',
    maxWait: 20000,
  });
  // Accept dialog for link preview
  await device1.clickOnByAccessibilityID('Enable');
  // No preview on first send
  await device1.clickOnByAccessibilityID('Send message button');
  // Send again for image
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  await sleepFor(500);
  await device1.clickOnByAccessibilityID('Send message button');
  // Make sure image preview is available in device 2
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testLink,
  });
  // Wait for 30 seconds to disappear
  await sleepFor(30000);
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testLink,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testLink,
    }),
  ]);
  await closeApp(device1, device2);
}

async function disappearingLinkMessage1o1Android(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  // await device1.navigateBack();
  // Send a link
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await device1.clickOnByAccessibilityID('Enable');
  // No preview on first send
  // Wait for preview to load
  await sleepFor(1000);
  await device1.clickOnByAccessibilityID('Send message button');
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Sent',
    maxWait: 20000,
  });
  // Send again for image
  // Make sure image preview is available in device 2
  await device2.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/linkPreviewView',
  });
  // Wait for 30 seconds to disappear
  await sleepFor(30000);
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'id',
      selector: 'network.loki.messenger:id/linkPreviewView',
      maxWait: 1000,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'id',
      selector: 'network.loki.messenger:id/linkPreviewView',
      maxWait: 1000,
    }),
  ]);
  await closeApp(device1, device2);
}
