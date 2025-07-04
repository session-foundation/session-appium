import { runOnlyOnIOS, sleepFor } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';
import { SupportedPlatformsType } from './open_app';

export const newContact = async (
  platform: SupportedPlatformsType,
  device1: DeviceWrapper,
  sender: Pick<User, 'userName'>,
  device2: DeviceWrapper,
  receiver: Pick<User, 'userName' | 'accountID'>
) => {
  await device1.sendNewMessage(receiver, `${sender.userName} to ${receiver.userName}`);
  // Click on message request folder
  await sleepFor(100);
  await runOnlyOnIOS(platform, () => retryMsgSentForBanner(platform, device1, device2, 30000)); // this runOnlyOnIOS is needed

  await device2.clickOnByAccessibilityID('Message requests banner');
  await device2.clickOnByAccessibilityID('Message request');
  await device2.onAndroid().clickOnByAccessibilityID('Accept message request');
  // Type into message input box
  const replyMessage = `Reply-message-${receiver.userName}-to-${sender.userName}`;
  await device2.sendMessage(replyMessage);

  // Verify config message states message request was accepted
  // "messageRequestsAccepted": "Your message request has been accepted.",
  // TO DO - ADD BACK IN ONCE IOS AND ANDROID HAS FIXED THIS ISSUE
  // const messageRequestsAccepted = englishStrippedStr('messageRequestsAccepted').toString();
  // await device1.onAndroid().waitForControlMessageToBePresent(messageRequestsAccepted);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  console.info(`${sender.userName} and ${receiver.userName} are now contacts`);
  return { sender, receiver, device1, device2 };
};

export const retryMsgSentForBanner = async (
  _platform: SupportedPlatformsType,
  device1: DeviceWrapper,
  device2: DeviceWrapper,
  timeout: number
) => {
  const startTime = Date.now();
  let messageRequest: boolean | null = false;

  while (!messageRequest && Date.now() - startTime < timeout) {
    const element = await device2.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Message requests banner',
      maxWait: 5000,
    });

    messageRequest = element !== null;

    if (!messageRequest) {
      device1.log(`Retrying message request`);
      await device1.sendMessage('Retry');
      await sleepFor(5000);
    } else {
      device2.log('Found message request: No need for retry');
    }
  }

  if (!messageRequest) {
    throw new Error(
      'Message request did not appear within the timeout period: This is a common race condition on iOS.'
    );
  }
};
