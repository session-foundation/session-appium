import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Accept message request with text', 'high', acceptRequestWithText);

async function acceptRequestWithText(platform: SupportedPlatformsType) {
  // Check accept request by sending text message
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create two users
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const testMessage = `${userA.userName} to ${userB.userName}`;
  // Send message from Alice to Bob
  await device1.clickOnByAccessibilityID('New conversation button');
  // Select direct message option
  await device1.clickOnByAccessibilityID('New direct message');
  // Enter User B's session ID into input box
  await device1.inputText(userB.accountID, {
    strategy: 'accessibility id',
    selector: 'Session id input box',
  });
  // Click next
  await device1.scrollDown();
  await device1.clickOnByAccessibilityID('Next');
  //messageRequestPendingDescription: "You will be able to send voice messages and attachments once the recipient has approved this message request."
  const messageRequestPendingDescription = englishStripped(
    'messageRequestPendingDescription'
  ).toString();
  await device1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: messageRequestPendingDescription,
  });
  await device1.onAndroid().waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/textSendAfterApproval',
    text: messageRequestPendingDescription,
  });

  await device1.inputText(testMessage, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Click send
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Send message button',
  });
  // Wait for tick
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: `Message sent status: Sent`,
    maxWait: 50000,
  });
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Bob clicks on request conversation item
  await device2.clickOnByAccessibilityID('Message request');
  // Check control message warning of sending message request reply
  // "messageRequestsAcceptDescription": "Sending a message to this user will automatically accept their message request and reveal your Account ID."
  const messageRequestsAcceptDescription = englishStripped(
    'messageRequestsAcceptDescription'
  ).toString();
  await device2.onIOS().waitForControlMessageToBePresent(messageRequestsAcceptDescription);

  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/sendAcceptsTextView',
    text: messageRequestsAcceptDescription,
  });

  // Send message from Bob to Alice
  await device2.sendMessage(`${userB.userName} to ${userA.userName}`);
  // Check control message for message request acceptance
  // "messageRequestsAccepted": "Your message request has been accepted.",
  const messageRequestsAccepted = englishStripped('messageRequestsAccepted').strip().toString();
  const messageRequestYouHaveAccepted = englishStripped('messageRequestYouHaveAccepted')
    .withArgs({ name: userA.userName })
    .toString();
  await Promise.all([
    device1.waitForControlMessageToBePresent(messageRequestsAccepted),
    device2.waitForControlMessageToBePresent(messageRequestYouHaveAccepted),
  ]);
  // Close app
  await closeApp(device1, device2);
}
