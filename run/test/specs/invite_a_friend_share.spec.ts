import { bothPlatformsIt } from '../../types/sessionIt';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { USERNAME } from '../../types/testing';
import { PlusButton } from './locators/home';
import { AccountIDField, InviteAFriendOption, ShareButton } from './locators/start_conversation';
import { IOS_XPATHS } from '../../constants';

// TODO assign risk assessment value once PR 16 is merged (assumption: high)
bothPlatformsIt('Invite a friend', inviteAFriend)

async function inviteAFriend(platform: SupportedPlatformsType) {
    const { device } = await openAppOnPlatformSingleDevice(platform);
    let messageElement;
    // This is a const so that the user.accountID can be used later on 
    const user = await newUser(device, USERNAME.ALICE, platform);
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
    }
    else {
        messageElement = await device.waitForTextElementToBePresent({
            strategy: 'id',
            selector: 'android:id/content_preview_text',
        })
    }
    // Retrieve the Share message and validate that it contains the user's Account ID 
    const retrievedShareMessage = await device.getTextFromElement(messageElement)
    if (retrievedShareMessage.includes(user.accountID)) {
        console.log("The Invite a Friend message snippet contains the user's Account ID")
    }
    else {
        throw new Error(`The Invite a Friend message snippet does not contain the user's Account ID\nThe message goes ${retrievedShareMessage}`)
    }
    await closeApp(device);
    };