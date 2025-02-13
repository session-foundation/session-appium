import { englishStripped } from '../../localizer/i18n/localizedString';
import { iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EmptyConversation } from './locators/conversation';
import { NoteToSelfOption } from './locators/global_search';
import { SearchButton } from './locators/home';
import { newUser } from './utils/create_account';
import { openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

iosIt('Hide note to self', 'low', hideNoteToSelf);
// Android currently shows 'Clear' instead of 'Hide' for note to self
// androidIt('Hide note to self', 'low', hideNoteToSelf);

async function hideNoteToSelf(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await newUser(device, USERNAME.ALICE);
  await device.clickOnElementAll(new SearchButton(device));
  await device.clickOnElementAll(new NoteToSelfOption(device));
  await device.waitForTextElementToBePresent(
    new EmptyConversation(device).build(englishStripped('noteToSelfEmpty').toString())
  );
  await device.sendMessage('Creating note to self');
  await device.navigateBack();
  await device.clickOnByAccessibilityID('Cancel');
  await device
    .onIOS()
    .swipeLeft('Conversation list item', englishStripped('noteToSelf').toString());
  await device.onAndroid().longPressConversation(englishStripped('noteToSelf').toString());
  await device.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Hide',
  });
  await device.checkModalStrings(
    englishStripped('noteToSelfHide').toString(),
    englishStripped('noteToSelfHideDescription').toString()
  );
  await device.clickOnElementAll({
    strategy: 'accessibility id',
    selector: englishStripped('hide').toString(),
  });
  await device.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: englishStripped('noteToSelf').toString(),
  });
}
