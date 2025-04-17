import { englishStripped } from '../../localizer/Localizer';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EmptyConversation, Hide } from './locators/conversation';
import { CancelSearchButton, NoteToSelfOption } from './locators/global_search';
import { SearchButton } from './locators/home';
import { newUser } from './utils/create_account';
import { openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

iosIt('Hide note to self', 'low', hideNoteToSelf);
// Android currently shows 'Clear' instead of 'Hide' for note to self
androidIt('Hide note to self', 'low', hideNoteToSelf, true);

async function hideNoteToSelf(platform: SupportedPlatformsType) {
  const noteToSelf = englishStripped('noteToSelf').toString();
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await newUser(device, USERNAME.ALICE);
  await device.clickOnElementAll(new SearchButton(device));
  await device.clickOnElementAll(new NoteToSelfOption(device));
  await device.waitForTextElementToBePresent(
    new EmptyConversation(device).build(englishStripped('noteToSelfEmpty').toString())
  );
  await device.sendMessage('Creating note to self');
  await device.navigateBack();
  await device.clickOnElementAll(new CancelSearchButton(device));
  await device.onIOS().swipeLeft('Conversation list item', noteToSelf);
  await device.onAndroid().longPressConversation(noteToSelf);
  await device.clickOnElementAll(new Hide(device));
  await device.checkModalStrings(
    englishStripped('noteToSelfHide').toString(),
    englishStripped('noteToSelfHideDescription').toString()
  );
  await device.clickOnElementAll(new Hide(device));
  await device.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: noteToSelf,
  });
}
