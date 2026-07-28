import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { EmptyConversation, Hide } from '../../locators/conversation';
import { CancelSearchButton, NoteToSelfOption } from '../../locators/global_search';
import { ConversationItem, SearchButton } from '../../locators/home';
import { open_Alice2 } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';

bothPlatformsIt({
  title: 'Hide note to self linked device',
  risk: 'low',
  testCb: hideNoteToSelf,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Hide Note to Self',
  },
  allureDescription: 'Verifies that Hide Note To Self syncs to a linked device.',
});

async function hideNoteToSelf(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice2({ platform, testInfo });
  });
  const { alice1, alice2 } = devices;

  const noteToSelf = tStripped('noteToSelf');
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
        tStripped('noteToSelfHide'),
        tStripped('hideNoteToSelfDescription') // This one fails on iOS, see SES-4144
      );
    });
    await alice1.clickOnByAccessibilityID('Hide');
  });
  // Note to Self was shown on alice2 above, before the hide, so both devices only need to be seen to
  // lose it here. hasElementBeenDeleted would re-check presence first, which races the hide: on
  // alice2 against the sync, and on alice1 against its own local update.
  //
  // The iOS branch this replaces attributed itself to page structure, but both platforms allowed the
  // same 5s for the element to go — all the extra iOS wait bought was time for it to be *found*
  // first, which is the phase being dropped. So the windows are unchanged.
  await test.step('Verify Note to Self is hidden on both devices', async () => {
    await Promise.all([
      alice1.waitForElementToBeGone({
        ...new ConversationItem(alice1, noteToSelf).build(),
        maxWait: 5_000,
      }),
      alice2.waitForElementToBeGone({
        ...new ConversationItem(alice2, noteToSelf).build(),
        maxWait: 20_000,
      }),
    ]);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, alice2);
  });
}
