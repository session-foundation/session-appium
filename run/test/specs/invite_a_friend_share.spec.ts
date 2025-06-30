import type { TestInfo } from '@playwright/test';

import { IOS_XPATHS } from '../../constants';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { PlusButton } from './locators/home';
import { AccountIDField, InviteAFriendOption, ShareButton } from './locators/start_conversation';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Invite a friend',
  risk: 'medium',
  testCb: inviteAFriend,
  countOfDevicesNeeded: 1,
});

async function inviteAFriend(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  let messageElement;
  // This is a const so that the user.accountID can be used later on
  const user = await newUser(device, USERNAME.ALICE);
  // Hit the plus button
  await device.clickOnElementAll(new PlusButton(device));
  // Select Invite a Friend
  await device.clickOnElementAll(new InviteAFriendOption(device));
  // Check for presence of Account ID field
  await device.waitForTextElementToBePresent(new AccountIDField(device));
  // Tap Share
  await device.clickOnElementAll(new ShareButton(device));
  // defining the "Hey..." message element to retrieve the share message from
  if (platform === 'ios') {
    messageElement = await device.waitForTextElementToBePresent({
      strategy: 'xpath',
      selector: IOS_XPATHS.INVITE_A_FRIEND_SHARE,
    });
  } else {
    messageElement = await device.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'android:id/content_preview_text',
    });
  }
  // Retrieve the Share message and validate that it contains the user's Account ID
  const retrievedShareMessage = await device.getTextFromElement(messageElement);
  if (retrievedShareMessage.includes(user.accountID)) {
    console.log("The Invite a Friend message snippet contains the user's Account ID");
  } else {
    throw new Error(
      `The Invite a Friend message snippet does not contain the user's Account ID\nThe message goes ${retrievedShareMessage}`
    );
  }
  await closeApp(device);
}
