import { test, type TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { CommunityMessageAuthor, UPMMessageButton } from './locators/conversation';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { joinCommunity } from './utils/join_community';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Community message requests off',
  risk: 'medium',
  testCb: blindedMessageRequests,
  countOfDevicesNeeded: 2,
  allureSuites: { parent: 'Settings', suite: 'Community Message Requests' },
  allureDescription:
    'Verifies that a message request cannot be sent when Community Message Requests are off.',
});

async function blindedMessageRequests(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const message = `I do not accept blinded message requests + ${platform} + ${Date.now()}`;
  const { device1, device2 } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
    await Promise.all([
      newUser(device1, USERNAME.ALICE, { saveUserData: false }),
      newUser(device2, USERNAME.BOB, { saveUserData: false }),
    ]);
    return { device1, device2 };
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await Promise.all(
      [device1, device2].map(async device => {
        await joinCommunity(device, testCommunityLink, testCommunityName);
      })
    );
  });
  await test.step(TestSteps.SEND.MESSAGE(USERNAME.BOB, testCommunityName), async () => {
    await device2.sendMessage(message);
  });
  await device1.clickOnElementAll(new CommunityMessageAuthor(device1, message));
  await test.step(`Verify the 'Message' button in the User Profile Modal is disabled`, async () => {
    // brief sleep to let the UI settle 
    await sleepFor(1000);
    const messageButton = await device1.waitForTextElementToBePresent(
      new UPMMessageButton(device1)
    );
    const attr = await device1.getAttribute('enabled', messageButton.ELEMENT);
    if (attr !== 'false') {
      device1.log(`Message button attribute is 'enabled = ${attr}'`);
      throw new Error(`Message button should be disabled but it is not`);
    }
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device1, device2);
  });
}
