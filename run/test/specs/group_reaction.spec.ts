import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { GROUPNAME } from '../../types/testing';
import { EmojiReactsCount, EmojiReactsPill, FirstEmojiReact } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send emoji react groups',
  risk: 'high',
  countOfDevicesNeeded: 3,
  testCb: sendEmojiReactionGroup,
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Emoji reacts',
  },
  allureDescription: 'Verifies that an emoji reaction can be sent and is received in a group.',
});

async function sendEmojiReactionGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const groupName: GROUPNAME = 'Message checks for groups';
  const message = 'Testing emoji reacts';
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      focusGroupConvo: true,
      groupName: groupName,
      testInfo,
    });
  });
  await test.step(TestSteps.SEND.MESSAGE(alice.userName, groupName), async () => {
    await alice1.sendMessage(message);
  });
  await test.step(TestSteps.SEND.EMOJI_REACT, async () => {
    await Promise.all(
      [bob1, charlie1].map(async device => {
        await device.longPressMessage(message);
        await device.clickOnElementAll(new FirstEmojiReact(device));
        // Verify long press menu disappeared (so next found emoji is in convo and not in react bar)
        await device.verifyElementNotPresent({
          strategy: 'accessibility id',
          selector: 'Reply to message',
        });
      })
    );
  });
  await test.step(TestSteps.VERIFY.EMOJI_REACT, async () => {
    // All clients witness emoji and "2" count
    await Promise.all(
      [alice1, bob1, charlie1].map(async device => {
        await device.waitForTextElementToBePresent(new EmojiReactsPill(device, message));
        await device.waitForTextElementToBePresent(new EmojiReactsCount(device, message, '2'));
      })
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
