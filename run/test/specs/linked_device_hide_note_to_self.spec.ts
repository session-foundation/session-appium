import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { EmptyConversation, Hide } from './locators/conversation';
import { CancelSearchButton, NoteToSelfOption } from './locators/global_search';
import { ConversationItem, SearchButton } from './locators/home';
import { open_Alice2 } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Hide note to self linked device',
  risk: 'low',
  testCb: hideNoteToSelf,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Hide Note to Self',
  },
});

async function hideNoteToSelf(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice2({ platform, testInfo });
  });
  const { alice1, alice2 } = devices;

  const noteToSelf = englishStrippedStr('noteToSelf').toString();
  await test.step('Open Note to Self and send a message', async () => {
    await alice1.clickOnElementAll(new SearchButton(alice1));
    await alice1.clickOnElementAll(new NoteToSelfOption(alice1));
    await alice1.waitForTextElementToBePresent(new EmptyConversation(alice1));
    await alice1.sendMessage('Buy milk');
  });

  await test.step('Verify Note to Self appears on linked device', async () => {
    await alice2.waitForTextElementToBePresent(new ConversationItem(alice2, noteToSelf));
  });
  await test.step('Hide Note to Self from home screen', async () => {
    await alice1.navigateBack();
    await alice1.clickOnElementAll(new CancelSearchButton(alice1));
    await alice1.onIOS().swipeLeft('Conversation list item', noteToSelf);
    await alice1.onAndroid().longPressConversation(noteToSelf);
    await alice1.clickOnElementAll(new Hide(alice1));
    await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('noteToSelfHide').toString(),
        englishStrippedStr('hideNoteToSelfDescription').toString() // This one fails on iOS, see SES-4144
      );
    });
    await alice1.clickOnByAccessibilityID('Hide');
  });
  await test.step('Verify Note to Self is hidden on both devices', async () => {
    if (platform === 'android') {
      await Promise.all([
        alice1.verifyElementNotPresent({
          ...new ConversationItem(alice1, noteToSelf).build(),
          maxWait: 5_000,
        }),
        alice2.hasElementBeenDeleted({
          ...new ConversationItem(alice2, noteToSelf).build(),
          maxWait: 20_000,
        }),
      ]);
    } else {
      // iOS page structure is more flaky and the element can still be present
      await Promise.all([
        alice1.hasElementBeenDeleted({
          ...new ConversationItem(alice1, noteToSelf).build(),
          maxWait: 5_000,
        }),
        alice2.hasElementBeenDeleted({
          ...new ConversationItem(alice2, noteToSelf).build(),
          maxWait: 20_000,
        }),
      ]);
    }
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, alice2);
  });
}
