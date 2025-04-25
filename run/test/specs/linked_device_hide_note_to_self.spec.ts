import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { EmptyConversation, Hide } from './locators/conversation';
import { CancelSearchButton, NoteToSelfOption } from './locators/global_search';
import { SearchButton } from './locators/home';
import { open2AppsLinkedUser } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Hide note to self linked device',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: hideNoteToSelf,
  },
  android: {
    testCb: hideNoteToSelf,
    // Android currently shows 'Clear' instead of 'Hide' for note to self
    shouldSkip: true,
  },
});

async function hideNoteToSelf(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsLinkedUser({ platform });

  const noteToSelf = englishStripped('noteToSelf').toString();
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
  await device1.clickOnElementAll(new CancelSearchButton(device1));
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
