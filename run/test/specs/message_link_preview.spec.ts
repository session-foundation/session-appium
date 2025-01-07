import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, openAppTwoDevices, closeApp } from './utils/open_app';

iosIt('Send link 1:1', 'high', sendLinkIos);
androidIt('Send link 1:1', 'high', sendLinkAndroid);

async function sendLinkIos(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testLink = `https://getsession.org/`;
  // Create two users
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const replyMessage = `Replying to link from ${userA.userName}`;
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // Send a link

  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // await device1.waitForLoadingAnimation();
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

  await device2.longPressMessage(testLink);
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await closeApp(device1, device2);
}

async function sendLinkAndroid(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testLink = `https://getsession.org/`;
  // Create two users
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // Send a link
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Enable',
  });
  //wait for preview to generate
  await sleepFor(5000);
  await device1.clickOnByAccessibilityID('Send message button');
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Sent',
    maxWait: 25000,
  });
  await device2.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/linkPreviewView',
  });
  await closeApp(device1, device2);
}
