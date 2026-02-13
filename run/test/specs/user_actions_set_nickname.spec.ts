import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ConversationHeaderName,
  ConversationSettings,
  EditNicknameButton,
  NicknameInput,
  PreferredDisplayName,
  SaveNicknameButton,
} from '../locators/conversation';
import { ConversationItem } from '../locators/home';
import { open_Alice1_Bob1_friends } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Set nickname',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: setNickname,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Set Nickname',
  },
  allureDescription: `Verifies that a user can set a nickname for a contact and that it appears correctly in the conversation settings, conversation header and home screen.`,
});

async function setNickname(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: true,
      testInfo,
    });
  });
  const nickName = 'My best friend';
  await test.step("Open 'Set Nickname' modal and change nickname", async () => {
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new EditNicknameButton(alice1));
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Set Nickname'), async () => {
      await alice1.checkModalStrings(
        tStripped('nicknameSet'),
        tStripped('nicknameDescription', { name: USERNAME.BOB })
      );
    });
    await alice1.clickOnElementAll(new NicknameInput(alice1));
    await alice1.inputText(nickName, new NicknameInput(alice1));
    await alice1.clickOnElementAll(new SaveNicknameButton(alice1));
  });
  await test.step(TestSteps.VERIFY.NICKNAME_CHANGED('conversation settings'), async () => {
    await alice1.waitForTextElementToBePresent(new PreferredDisplayName(alice1, nickName));
  });
  await test.step(TestSteps.VERIFY.NICKNAME_CHANGED('conversation header'), async () => {
    await alice1.navigateBack();
    await alice1.waitForTextElementToBePresent(new ConversationHeaderName(alice1));
  });
  await test.step(TestSteps.VERIFY.NICKNAME_CHANGED('home screen'), async () => {
    await alice1.navigateBack();
    await alice1.waitForTextElementToBePresent({
      ...new ConversationItem(alice1, nickName).build(),
      maxWait: 10_000,
    });
  });
  // Close app
  await closeApp(alice1, bob1);
}
