import { englishStripped } from '../../localizer/Localizer';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { LinkPreview, LinkPreviewMessage } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';
import { OutgoingMessageStatusSent } from './locators/conversation';

iosIt('Send link to group', 'high', sendLinkGroupiOS);
androidIt('Send link to group', 'high', sendLinkGroupAndroid);

async function sendLinkGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const testLink = `https://getsession.org/`;
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  const replyMessage = `Replying to link from ${userA.userName} in group ${testGroupName}`;
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  await device1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(device1).build(),
    maxWait: 20000,
  });

  // Accept dialog for link preview
  await device1.checkModalStrings(
    englishStripped('linkPreviewsEnable').toString(),
    englishStripped('linkPreviewsFirstDescription').toString()
  );
  await device1.clickOnByAccessibilityID('Enable');
  // No preview on first send
  await device1.clickOnByAccessibilityID('Send message button');
  // Send again for image
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  await device1.waitForTextElementToBePresent(new LinkPreview(device1));
  await device1.clickOnByAccessibilityID('Send message button');
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testLink,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testLink,
  });
  // Reply to link
  await device2.longPressMessage(testLink);
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await closeApp(device1, device2, device3);
}

async function sendLinkGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  const testLink = `https://getsession.org/`;
  // Send a link
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await device1.checkModalStrings(
    englishStripped('linkPreviewsEnable').toString(),
    englishStripped('linkPreviewsFirstDescription').toString(),
    true
  );
  await device1.clickOnByAccessibilityID('Enable');
  //wait for preview to generate
  await sleepFor(5000);
  // No preview on first send
  await device1.clickOnByAccessibilityID('Send message button');
  await device1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(device1).build(),
    maxWait: 20000,
  });
  await Promise.all([
    device2.waitForTextElementToBePresent(new LinkPreviewMessage(device2)),
    device3.waitForTextElementToBePresent(new LinkPreviewMessage(device3)),
  ]);
  await device2.longPressMessage(testLink);
  await device2.clickOnByAccessibilityID('Reply to message');
  const replyMessage = await device2.sendMessage(`${userA.userName} message reply`);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
  ]);
  await closeApp(device1, device2, device3);
}
