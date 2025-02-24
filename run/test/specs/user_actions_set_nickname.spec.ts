import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
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
  await device1.clickOnElementAll(new ConversationSettings(device1));
  // Click on username to set nickname
  await device1.clickOnByAccessibilityID('Username');
  await sleepFor(500);
  await device1.clickOnByAccessibilityID('Username');
  await device1.deleteText({ strategy: 'accessibility id', selector: 'Username' });
  // Type in nickname
  await device1.inputText(nickName, { strategy: 'accessibility id', selector: 'Username' });
  // Click apply/done
  await device1.clickOnByAccessibilityID('Done');
  // Check it's changed in heading also
  await device1.navigateBack();
  const newNickname = await device1.grabTextFromAccessibilityId('Conversation header name');
  await device1.findMatchingTextAndAccessibilityId('Conversation header name', newNickname);
  // Check in conversation list also
  await device1.navigateBack();
  // Save text of conversation list item?
  await sleepFor(1000);
  await device1.findMatchingTextAndAccessibilityId('Conversation list item', nickName);
  // Set nickname back to original username
  await device1.selectByText('Conversation list item', nickName);
  // Click on settings/more info
  await device1.clickOnElementAll(new ConversationSettings(device1));
  // Click on edit
  await device1.clickOnByAccessibilityID('Username');
  // Empty username input
  await device1.deleteText({ strategy: 'accessibility id', selector: 'Username' });
  await device1.inputText(' ', { strategy: 'accessibility id', selector: 'Username' });
  await device1.clickOnByAccessibilityID('Done');
  // Check in conversation header
  await device1.navigateBack();
  // await sleepFor(500);
  const revertedNickname = await device1.grabTextFromAccessibilityId('Conversation header name');
  console.info(`revertedNickname:` + revertedNickname);
  if (revertedNickname !== userB.userName) {
    throw new Error(`revertedNickname doesn't match username`);
  }
  await device1.navigateBack();
  // Check in conversation list aswell
  await device1.findMatchingTextAndAccessibilityId('Conversation list item', userB.userName);
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
