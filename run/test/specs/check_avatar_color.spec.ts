import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import { ConversationItem } from './locators/home';
import { UserSettings } from './locators/settings';
import { open_Alice1_Bob1_friends } from './state_builder';
import { isSameColor } from './utils/check_colour';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Avatar color',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: avatarColor,
  allureSuites: {
    parent: 'Visual Checks',
  },
  allureDescription: `Verifies that a user's placeholder avatar color appears the same to a contact`,
});

async function avatarColor(platform: SupportedPlatformsType, testInfo: TestInfo) {
  let alice1PixelColor: string = '',
    bob1PixelColor: string = '';
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
  await test.step(`Get Alice's avatar color on their device from the Settings screen avatar`, async () => {
    await alice1.clickOnElementAll(new UserSettings(alice1));
    alice1PixelColor = await alice1.getElementPixelColor(new UserSettings(alice1));
  });
  await test.step(`Get Alice's avatar color on bob's device from the Conversation Settings avatar`, async () => {
    await bob1.clickOnElementAll(new ConversationItem(bob1, alice.userName));
    bob1PixelColor = await bob1.getElementPixelColor(new ConversationSettings(bob1));
  });
  await test.step('Compare the avatar colors', () => {
    const colorMatch = isSameColor(alice1PixelColor, bob1PixelColor);
    if (!colorMatch) {
      throw new Error(
        `The avatar color of ${alice.userName} does not match across devices. The colors are ${alice1PixelColor} and ${bob1PixelColor}`
      );
    }
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
