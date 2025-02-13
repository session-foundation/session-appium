import { englishStripped } from '../../localizer/i18n/localizedString';
import { iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EmptyConversation, Hide } from './locators/conversation';
import { NoteToSelfOption } from './locators/global_search';
import { SearchButton } from './locators/home';
import { linkedDevice } from './utils/link_device';
import { openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

iosIt('Hide note to self linked device', 'low', hideNoteToSelf);
// Android currently shows 'Clear' instead of 'Hide' for note to self
// androidIt('Hide note to self linked device', 'low', hideNoteToSelf);

async function hideNoteToSelf(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const noteToSelf = englishStripped('noteToSelf').toString();
  await linkedDevice(device1, device2, USERNAME.ALICE);
  await device1.clickOnElementAll(new SearchButton(device1));
  await device1.clickOnElementAll(new NoteToSelfOption(device1));
  await device1.waitForTextElementToBePresent(
    new EmptyConversation(device1).build(englishStripped('noteToSelfEmpty').toString())
  );
  await device1.sendMessage('Creating note to self');
  await device1.navigateBack();
  // Does note to self appear on linked device
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: noteToSelf,
  });
  await device1.clickOnByAccessibilityID('Cancel');
  await device1.onIOS().swipeLeft('Conversation list item', noteToSelf);
  await device1.onAndroid().longPressConversation(noteToSelf);
  await device1.clickOnElementAll(new Hide(device1));
  await device1.checkModalStrings(
    englishStripped('noteToSelfHide').toString(),
    englishStripped('noteToSelfHideDescription').toString()
  );
  await device1.clickOnElementAll(new Hide(device1));
  await Promise.all(
    [device1, device2].map(device =>
      device.doesElementExist({
        strategy: 'accessibility id',
        selector: 'Conversation list item',
        text: noteToSelf,
        maxWait: 5000,
      })
    )
  );
}
