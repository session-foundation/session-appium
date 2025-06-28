import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EmptyConversation, Hide } from './locators/conversation';
import { CancelSearchButton, NoteToSelfOption } from './locators/global_search';
import { SearchButton } from './locators/home';
import { newUser } from './utils/create_account';
import { openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsItSeparate({
  title: 'Hide note to self',
  risk: 'low',
  countOfDevicesNeeded: 1,
  ios: {
    testCb: hideNoteToSelf,
  },
  android: {
    testCb: hideNoteToSelf,
    // Android currently shows 'Clear' instead of 'Hide' for note to self
    shouldSkip: true,
  },
});

async function hideNoteToSelf(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const noteToSelf = englishStrippedStr('noteToSelf').toString();
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE);
  await device.clickOnElementAll(new SearchButton(device));
  await device.clickOnElementAll(new NoteToSelfOption(device));
  await device.waitForTextElementToBePresent(
    new EmptyConversation(device).build(englishStrippedStr('noteToSelfEmpty').toString())
  );
  await device.sendMessage('Creating note to self');
  await device.navigateBack();
  await device.clickOnElementAll(new CancelSearchButton(device));
  await device.onIOS().swipeLeft('Conversation list item', noteToSelf);
  await device.onAndroid().longPressConversation(noteToSelf);
  await device.clickOnElementAll(new Hide(device));
  await device.checkModalStrings(
    englishStrippedStr('noteToSelfHide').toString(),
    englishStrippedStr('noteToSelfHideDescription').toString()
  );
  await device.clickOnElementAll(new Hide(device));
  await device.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: noteToSelf,
  });
}
