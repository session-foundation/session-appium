import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { UsernameInput } from './locators';
import { ConversationSettings } from './locators/conversation';
import { SaveNameChangeButton } from './locators/settings';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Set nickname',
  risk: 'high',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: setNicknameIos,
  },
  android: {
    testCb: setNicknameAndroid,
  },
});

async function setNicknameIos(platform: SupportedPlatformsType) {
  const nickName = 'New nickname';
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  // Click on settings/more info
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Click on username to set nickname
  await alice1.clickOnByAccessibilityID('Username');
  await alice1.clickOnElementAll(new UsernameInput(alice1));
  await sleepFor(500);
  await alice1.checkModalStrings(
    englishStripped('nicknameSet').toString(),
    englishStripped('nicknameDescription').withArgs({ name: USERNAME.BOB }).toString()
  );
  // Type in nickname
  // await alice1.deleteText(new UsernameInput(alice1));
  await alice1.inputText(nickName, new UsernameInput(alice1));
  // Click apply/done
  await alice1.clickOnElementAll(new SaveNameChangeButton(alice1));
  // Check it's changed in heading also
  await alice1.navigateBack();
  const newNickname = await alice1.grabTextFromAccessibilityId('Conversation header name');
  if (newNickname !== nickName) {
    throw new Error('Nickname has not been changed in header');
  }
  // Check in conversation list also
  await alice1.navigateBack();
  await sleepFor(500);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: newNickname,
  });
  // Close app
  await closeApp(alice1, bob1);
}

async function setNicknameAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const nickName = 'New nickname';
  // Go back to conversation list
  await alice1.navigateBack();
  // Select conversation in list with Bob
  await alice1.longPressConversation(bob.userName);
  // Select 'Details' option
  await alice1.clickOnByAccessibilityID('Details');
  // Select username to edit
  await alice1.clickOnByAccessibilityID('Edit user nickname');
  // Type in nickname
  await alice1.inputText(nickName, { strategy: 'accessibility id', selector: 'Display name' });
  // Click on tick button
  await alice1.clickOnByAccessibilityID('Apply');
  // CLick out of pop up
  await alice1.clickOnByAccessibilityID('Message user');
  // Check name at top of conversation is nickname
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
  });
  // Send a message so nickname is updated in conversation list
  await alice1.sendMessage('Message to test nickname change');
  const actualNickname = await alice1.grabTextFromAccessibilityId('Conversation header name');
  if (actualNickname !== nickName) {
    throw new Error('Nickname has not been changed in header');
  }
  // Close app
  await closeApp(alice1, bob1);
}
