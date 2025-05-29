import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { BlockedContactsSettings, BlockUserConfirmationModal } from './locators';
import { LongPressBlockOption } from './locators/home';
import { ConversationsMenuItem, UserSettings } from './locators/settings';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

// Block option no longer available on iOS in conversation list
androidIt({
  title: 'Block user in conversation list',
  risk: 'high',
  testCb: blockUserInConversationList,
  countOfDevicesNeeded: 2,
});

async function blockUserInConversationList(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  // Navigate back to conversation list
  await alice1.navigateBack();
  await alice1.longPressConversation(bob.userName);
  await alice1.clickOnElementAll(new LongPressBlockOption(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('block').toString(),
    englishStrippedStr('blockDescription').withArgs({ name: USERNAME.BOB }).toString(),
    true
  );
  await alice1.clickOnElementAll(new BlockUserConfirmationModal(alice1));
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: bob.userName,
  });
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
  });
  await alice1.navigateBack();
  await alice1.clickOnElementAll(new UserSettings(alice1));
  await alice1.clickOnElementAll(new ConversationsMenuItem(alice1));
  await alice1.clickOnElementAll(new BlockedContactsSettings(alice1));
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: bob.userName,
  });
  await closeApp(alice1, bob1);
}
