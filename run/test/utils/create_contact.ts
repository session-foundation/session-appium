import { runOnlyOnIOS, sleepFor } from '.';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { User } from '../../types/testing';
import { MessageBody } from '../locators/conversation';
import { MessageRequestsBanner } from '../locators/home';
import { SupportedPlatformsType } from './open_app';

export const newContact = async (
  platform: SupportedPlatformsType,
  device1: DeviceWrapper,
  sender: Pick<User, 'userName'>,
  device2: DeviceWrapper,
  receiver: Pick<User, 'accountID' | 'userName'>
) => {
  await device1.sendNewMessage(receiver, `${sender.userName} to ${receiver.userName}`);
  // Click on message request folder
  await sleepFor(100);
  await runOnlyOnIOS(platform, () => retryMsgSentForBanner(platform, device1, device2, 30000)); // this runOnlyOnIOS is needed

  await device2.acceptMessageRequestWithButton();
  // Type into message input box
  const replyMessage = `${receiver.userName} to ${sender.userName}`;
  await device2.sendMessage(replyMessage);

  // Verify config message states message request was accepted
  // "messageRequestsAccepted": "Your message request has been accepted.",
  // TO DO - ADD BACK IN ONCE IOS AND ANDROID HAS FIXED THIS ISSUE
  // const messageRequestsAccepted = tStripped('messageRequestsAccepted');
  // await device1.onAndroid().waitForControlMessageToBePresent(messageRequestsAccepted);
  await device1.waitForTextElementToBePresent(new MessageBody(device1, replyMessage));
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
      ...new MessageRequestsBanner(device2).build(),
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
