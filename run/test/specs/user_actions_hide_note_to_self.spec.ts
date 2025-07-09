import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ConversationSettings,
  EmptyConversation,
  HideNoteToSelfConfirmButton,
  HideNoteToSelfMenuOption,
  ShowNoteToSelfConfirmButton,
  ShowNoteToSelfMenuOption,
} from './locators/conversation';
import { NoteToSelfOption } from './locators/global_search';
import { CancelSearchButton } from './locators/global_search';
import { ConversationItem, SearchButton } from './locators/home';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Hide note to self',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: hideNoteToSelf,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Hide Note to Self',
  },
});

async function hideNoteToSelf(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const noteToSelf = englishStrippedStr('noteToSelf').toString();

  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE);
    return { device };
  });

  await test.step('Open Note to Self and send a message', async () => {
    await device.clickOnElementAll(new SearchButton(device));
    await device.clickOnElementAll(new NoteToSelfOption(device));
    await device.waitForTextElementToBePresent(new EmptyConversation(device));
    await device.sendMessage('Buy milk');
  });

  await test.step('Hide Note to Self from UCS', async () => {
    await device.clickOnElementAll(new ConversationSettings(device));
    await device.clickOnElementAll(new HideNoteToSelfMenuOption(device));

    await test.step(TestSteps.VERIFY.MODAL_STRINGS, async () => {
      await device.checkModalStrings(
        englishStrippedStr('noteToSelfHide').toString(),
        englishStrippedStr('hideNoteToSelfDescription').toString()
      );
    });
    await device.clickOnElementAll(new HideNoteToSelfConfirmButton(device));
  });
  // Leave UCS, conversation and search
  await device.navigateBack();
  await device.navigateBack();
  await device.clickOnElementAll(new CancelSearchButton(device));

  await test.step('Verify Note to Self is hidden', async () => {
    await device.hasElementBeenDeleted({
      ...new ConversationItem(device, noteToSelf).build(),
      maxWait: 2000,
    });
  });

  await test.step('Show Note to Self from UCS', async () => {
    await device.clickOnElementAll(new SearchButton(device));
    await device.clickOnElementAll(new NoteToSelfOption(device));
    await device.clickOnElementAll(new ConversationSettings(device));
    await device.clickOnElementAll(new ShowNoteToSelfMenuOption(device));

    await test.step(TestSteps.VERIFY.MODAL_STRINGS, async () => {
      await device.checkModalStrings(
        englishStrippedStr('showNoteToSelf').toString(),
        englishStrippedStr('showNoteToSelfDescription').toString()
      );
    });
    await device.clickOnElementAll(new ShowNoteToSelfConfirmButton(device));
    // Leave UCS, conversation and search
    await device.navigateBack();
    await device.navigateBack();
    await device.clickOnElementAll(new CancelSearchButton(device));
    await test.step('Verify Note to Self shows again', async () => {
      await device.waitForTextElementToBePresent({
        ...new ConversationItem(device, noteToSelf).build(),
        maxWait: 5000,
      });
    });
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
