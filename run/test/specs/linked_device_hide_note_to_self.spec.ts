import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { EmptyConversation, Hide } from './locators/conversation';
import { CancelSearchButton, NoteToSelfOption } from './locators/global_search';
import { SearchButton } from './locators/home';
import { open_Alice2 } from './state_builder';
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
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform });

  const noteToSelf = englishStripped('noteToSelf').toString();
  await alice1.clickOnElementAll(new SearchButton(alice1));
  await alice1.clickOnElementAll(new NoteToSelfOption(alice1));
  await alice1.waitForTextElementToBePresent(
    new EmptyConversation(alice1).build(englishStripped('noteToSelfEmpty').toString())
  );
  await alice1.sendMessage('Creating note to self');
  await alice1.navigateBack();
  // Does note to self appear on linked device
  await alice2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: noteToSelf,
  });
  await alice1.clickOnElementAll(new CancelSearchButton(alice1));
  await alice1.onIOS().swipeLeft('Conversation list item', noteToSelf);
  await alice1.onAndroid().longPressConversation(noteToSelf);
  await alice1.clickOnElementAll(new Hide(alice1));
  await alice1.checkModalStrings(
    englishStripped('noteToSelfHide').toString(),
    englishStripped('noteToSelfHideDescription').toString()
  );
  await alice1.clickOnElementAll(new Hide(alice1));
  await Promise.all(
    [alice1, alice2].map(device =>
      device.doesElementExist({
        strategy: 'accessibility id',
        selector: 'Conversation list item',
        text: noteToSelf,
        maxWait: 5000,
      })
    )
  );
}
