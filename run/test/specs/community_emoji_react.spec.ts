import { test, type TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { EmojiReactsPill, FirstEmojiReact } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { joinCommunity } from './utils/join_community';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send emoji react community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: sendEmojiReactionCommunity,
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Emoji reacts',
  },
  allureDescription: 'Verifies that an emoji reaction can be sent and is received in a community',
});

async function sendEmojiReactionCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const message = `Testing emoji reacts - ${new Date().getTime()} - ${platform}`;
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
    });
  });
  await Promise.all(
    [alice1, bob1].map(device => joinCommunity(device, testCommunityLink, testCommunityName))
  );
  await test.step(TestSteps.SEND.MESSAGE(alice.userName, testCommunityName), async () => {
    await alice1.sendMessage(message);
  });
  await test.step(TestSteps.SEND.EMOJI_REACT, async () => {
    await bob1.scrollToBottom();
    await bob1.longPressMessage(message);
    await bob1.clickOnElementAll(new FirstEmojiReact(bob1));
    // Verify long press menu disappeared (so next found emoji is in convo and not in react bar)
    await bob1.verifyElementNotPresent({
      strategy: 'accessibility id',
      selector: 'Reply to message',
    });
  });
  await test.step(TestSteps.VERIFY.EMOJI_REACT, async () => {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.waitForTextElementToBePresent(new EmojiReactsPill(device, message))
      )
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
