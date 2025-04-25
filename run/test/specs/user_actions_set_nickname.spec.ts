import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { UsernameInput } from './locators';
import { ConversationSettings } from './locators/conversation';
import { SaveNameChangeButton } from './locators/settings';
import { open2AppsWithFriendsState } from './state_builder';
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
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  // Click on settings/more info
  await device1.clickOnElementAll(new ConversationSettings(device1));
  // Click on username to set nickname
  await device1.clickOnByAccessibilityID('Username');
  await device1.clickOnElementAll(new UsernameInput(device1));
  await sleepFor(500);
  await device1.checkModalStrings(
    englishStripped('nicknameSet').toString(),
    englishStripped('nicknameDescription').withArgs({ name: USERNAME.BOB }).toString()
  );
  // Type in nickname
  // await device1.deleteText(new UsernameInput(device1));
  await device1.inputText(nickName, new UsernameInput(device1));
  // Click apply/done
  await device1.clickOnElementAll(new SaveNameChangeButton(device1));
  // Check it's changed in heading also
  await device1.navigateBack();
  const newNickname = await device1.grabTextFromAccessibilityId('Conversation header name');
  if (newNickname !== nickName) {
    throw new Error('Nickname has not been changed in header');
  }
  // Check in conversation list also
  await device1.navigateBack();
  await sleepFor(500);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: newNickname,
  });
  // Close app
  await closeApp(device1, device2);
}

async function setNicknameAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userB },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  const nickName = 'New nickname';
  // Go back to conversation list
  await device1.navigateBack();
  // Select conversation in list with Bob
  await device1.longPressConversation(userB.userName);
  // Select 'Details' option
  await device1.clickOnByAccessibilityID('Details');
  // Select username to edit
  await device1.clickOnByAccessibilityID('Edit user nickname');
  // Type in nickname
  await device1.inputText(nickName, { strategy: 'accessibility id', selector: 'Display name' });
  // Click on tick button
  await device1.clickOnByAccessibilityID('Apply');
  // CLick out of pop up
  await device1.clickOnByAccessibilityID('Message user');
  // Check name at top of conversation is nickname
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
  });
  // Send a message so nickname is updated in conversation list
  await device1.sendMessage('Message to test nickname change');
  const actualNickname = await device1.grabTextFromAccessibilityId('Conversation header name');
  if (actualNickname !== nickName) {
    throw new Error('Nickname has not been changed in header');
  }
  // Close app
  await closeApp(device1, device2);
}
