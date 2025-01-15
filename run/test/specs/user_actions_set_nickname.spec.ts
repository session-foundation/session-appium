import { englishStripped } from '../../localizer/i18n/localizedString';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { UsernameInput, UsernameSettings } from './locators';
import { SaveNameChangeButton } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Set nickname', 'high', setNicknameIos);
androidIt('Set nickname', 'high', setNicknameAndroid);

async function setNicknameIos(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const nickName = 'New nickname';
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  // Click on settings/more info
  await device1.clickOnByAccessibilityID('More options');
  // Click on username to set nickname
  await device1.clickOnElementAll(new UsernameSettings(device1));
  await sleepFor(500);
  await device1.checkModalStrings(
    englishStripped('nicknameSet').toString(),
    englishStripped('nicknameDescription').withArgs({ name: USERNAME.BOB }).toString()
  );
  await device1.clickOnElementAll(new UsernameSettings(device1));
  // Type in nickname
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
  const { device1, device2 } = await openAppTwoDevices(platform);

  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const nickName = 'New nickname';
  await newContact(platform, device1, userA, device2, userB);
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
  const headerElement = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
  });
  await device1.getTextFromElement(headerElement);
  // Send a message so nickname is updated in conversation list
  await device1.sendMessage('Howdy');
  // Navigate out of conversation
  await device1.navigateBack();
  // Change nickname back to original username
  // Long press on contact conversation
  await device1.longPressConversation(nickName);
  // Select details
  await device1.clickOnByAccessibilityID('Details');
  // Click on username to edit
  await device1.clickOnByAccessibilityID('Edit user nickname');
  // Click apply without entering new nickname
  await device1.clickOnByAccessibilityID('Apply');
  // Click out of pop up
  await device1.back();
  // Enter conversation to verify change
  await device1.selectByText('Conversation list item', nickName);
  const changedElement = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
  });
  const headerUsername = await device1.getTextFromElement(changedElement);
  if (headerUsername === nickName) {
    console.log('Nickname has been changed in header correctly');
  }
  // Send message to change in conversation list
  await device1.sendMessage('Howdy');
  // Navigate back to list
  await device1.navigateBack();
  // Verify name change in list
  // Save text of conversation list item?
  await device1.selectByText('Conversation list item', nickName);
  const changedListName = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
    text: nickName,
  });
  const listName = await device1.getTextFromElement(changedListName);
  if (listName === nickName) {
    console.log('Nickname has been changed in list correctly');
  }

  // Close app
  await closeApp(device1, device2);
}
