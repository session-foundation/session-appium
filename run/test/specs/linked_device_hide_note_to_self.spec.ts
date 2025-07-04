import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
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
  const { devices } = await test.step('Restore pre-seeded accounts', async () => {
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

  // Does note to self appear on linked device
  await test.step('Verify Note to Self appears on linked device', async () => {
    await alice2.waitForTextElementToBePresent(new ConversationItem(alice2, noteToSelf));
  });
  await test.step('Hide Note to Self from home screen', async () => {
    await alice1.navigateBack();
    await alice1.clickOnElementAll(new CancelSearchButton(alice1));
    await alice1.onIOS().swipeLeft('Conversation list item', noteToSelf);
    await alice1.onAndroid().longPressConversation(noteToSelf);
    await alice1.clickOnElementAll(new Hide(alice1));
    await test.step('Verify modal strings', async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('noteToSelfHide').toString(),
        englishStrippedStr('hideNoteToSelfDescription').toString(),
        false
      );
    });
    await alice1.clickOnByAccessibilityID('Hide');
  });
  await test.step('Verify Note to Self is hidden on both devices', async () => {
    await Promise.all(
      [alice1, alice2].map(device =>
        device.hasElementBeenDeleted({
          ...new ConversationItem(device, noteToSelf).build(),
          maxWait: 10000, // This can take a while
        })
      )
    );
  });
  await test.step('Close app', async () => {
    await closeApp(alice1, alice2);
  });
}
