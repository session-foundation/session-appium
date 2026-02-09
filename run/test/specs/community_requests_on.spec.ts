import { test, type TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { CloseSettings } from './locators';
import {
  CommunityMessageAuthor,
  ConversationHeaderName,
  MessageBody,
  MessageRequestAcceptDescription,
  MessageRequestPendingDescription,
  UPMMessageButton,
} from './locators/conversation';
import { MessageRequestItem, MessageRequestsBanner } from './locators/home';
import { CommunityMessageRequestSwitch, PrivacyMenuItem, UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/community';
import { newUser } from './utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Community message requests on',
  risk: 'medium',
  testCb: blindedMessageRequests,
  countOfDevicesNeeded: 2,
  allureSuites: { parent: 'Settings', suite: 'Community Message Requests' },
  allureDescription:
    'Verifies that a message request can be sent when Community Message Requests are on.',
  allureLinks: {
    ios: 'SES-4722',
  },
});

async function blindedMessageRequests(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const message = `I accept blinded message requests + ${platform} + ${Date.now()}`;
  const messageRequestMessage = 'Howdy';
  const messageRequestReply = 'Howdy back';
  const { device1, device2, alice, bob } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
    const [alice, bob] = await Promise.all([
      newUser(device1, USERNAME.ALICE, { saveUserData: false }),
      newUser(device2, USERNAME.BOB, { saveUserData: false }),
    ]);
    return { device1, device2, alice, bob };
  });
  await test.step('Bob enables Community Message Requests', async () => {
    await device2.clickOnElementAll(new UserSettings(device2));
    await device2.clickOnElementAll(new PrivacyMenuItem(device2));
    await device2.clickOnElementAll(new CommunityMessageRequestSwitch(device2));
    await device2.navigateBack();
    await device2.clickOnElementAll(new CloseSettings(device2));
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await Promise.all(
      [device1, device2].map(async device => {
        await joinCommunity(device, testCommunityLink, testCommunityName);
      })
    );
  });

  await test.step(TestSteps.SEND.MESSAGE(bob.userName, testCommunityName), async () => {
    // brief sleep to let the UI settle
    await sleepFor(1000);
    await device2.sendMessage(message);
    await device2.navigateBack();
  });
  await test.step(TestSteps.SEND.MESSAGE(alice.userName, bob.userName), async () => {
    await device1.clickOnElementAll(new CommunityMessageAuthor(device1, message));
    await sleepFor(500); // brief sleep to let the UI settle
    await device1.clickOnElementAll(new UPMMessageButton(device1));
    await device1.clickOnElementAll(new ConversationHeaderName(device1, bob.userName));
    await device1.waitForTextElementToBePresent(new MessageRequestPendingDescription(device1));
    await device1.sendMessage(messageRequestMessage);
  });
  await test.step(`${bob.userName} accepts message request from ${alice.userName}`, async () => {
    await device2.clickOnElementAll(new MessageRequestsBanner(device2));
    // Bob clicks on request conversation item
    await device2.clickOnElementAll(new MessageRequestItem(device2));
    await device2.waitForTextElementToBePresent(
      new ConversationHeaderName(device2, alice.userName)
    );
    await device2.waitForTextElementToBePresent(new MessageBody(device2, messageRequestMessage));
    await device2.waitForTextElementToBePresent(new MessageRequestAcceptDescription(device2));
  });
  // Send message from Bob to Alice
  await test.step(TestSteps.SEND.MESSAGE(bob.userName, alice.userName), async () => {
    await device2.sendMessage(messageRequestReply);
    await device1.waitForTextElementToBePresent(new MessageBody(device1, messageRequestReply));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device1, device2);
  });
}
