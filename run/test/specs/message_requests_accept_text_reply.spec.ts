import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { MessageInput, OutgoingMessageStatusSent, SendButton } from './locators/conversation';
import { MessageRequestItem, PlusButton } from './locators/home';
import { MessageRequestsBanner } from './locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from './locators/start_conversation';
import { newUser } from './utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Accept message request with text',
  risk: 'high',
  testCb: acceptRequestWithText,
  countOfDevicesNeeded: 2,
});

async function acceptRequestWithText(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Check accept request by sending text message
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
  // Create two users
  const [alice, bob] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const testMessage = `${alice.userName} to ${bob.userName}`;
  // Send message from Alice to Bob
  await device1.clickOnElementAll(new PlusButton(device1));
  // Select direct message option
  await device1.clickOnElementAll(new NewMessageOption(device1));
  // Enter User B's session ID into input box
  await device1.inputText(bob.accountID, new EnterAccountID(device1));
  // Click next
  await device1.scrollDown();
  await device1.clickOnElementAll(new NextButton(device1));
  //messageRequestPendingDescription: "You will be able to send voice messages and attachments once the recipient has approved this message request."
  const messageRequestPendingDescription = englishStrippedStr(
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

  await device1.inputText(testMessage, new MessageInput(device1));
  // Click send
  await device1.clickOnElementAll(new SendButton(device1));
  // Wait for tick
  await device1.waitForTextElementToBePresent(new OutgoingMessageStatusSent(device1));
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnElementAll(new MessageRequestsBanner(device2));
  // Bob clicks on request conversation item
  await device2.clickOnElementAll(new MessageRequestItem(device2));
  // Check control message warning of sending message request reply
  // "messageRequestsAcceptDescription": "Sending a message to this user will automatically accept their message request and reveal your Account ID."
  const messageRequestsAcceptDescription = englishStrippedStr(
    'messageRequestsAcceptDescription'
  ).toString();
  await device2.onIOS().waitForControlMessageToBePresent(messageRequestsAcceptDescription);

  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/sendAcceptsTextView',
    text: messageRequestsAcceptDescription,
  });

  // Send message from Bob to Alice
  await device2.sendMessage(`${bob.userName} to ${alice.userName}`);
  // Check control message for message request acceptance
  // "messageRequestsAccepted": "Your message request has been accepted.",
  const messageRequestsAccepted = englishStrippedStr('messageRequestsAccepted').toString();
  const messageRequestYouHaveAccepted = englishStrippedStr('messageRequestYouHaveAccepted')
    .withArgs({ name: alice.userName })
    .toString();
  await Promise.all([
    device1.waitForControlMessageToBePresent(messageRequestsAccepted),
    device2.waitForControlMessageToBePresent(messageRequestYouHaveAccepted),
  ]);
  // Close app
  await closeApp(device1, device2);
}
