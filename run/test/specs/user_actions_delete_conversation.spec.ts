import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteContactModalConfirm } from './locators/global';
import { open_Alice2_Bob1_friends } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Delete conversation',
  risk: 'high',
  testCb: deleteConversation,
  countOfDevicesNeeded: 3,
});

async function deleteConversation(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2 },
    prebuilt: { bob },
  } = await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: false, testInfo });

  // Check contact has loaded on linked device
  // await alice1.navigateBack();
  // await bob1.navigateBack();
  // Check username has changed from session id on both device 1 and 3
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: bob.userName,
    }),
    alice2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: bob.userName,
    }),
  ]);
  // Delete conversation
  await alice1.onIOS().swipeLeft('Conversation list item', bob.userName);
  await alice1.onAndroid().longPressConversation(bob.userName);
  await alice1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });
  await alice1.checkModalStrings(
    englishStrippedStr('conversationsDelete').toString(),
    englishStrippedStr('conversationsDeleteDescription')
      .withArgs({ name: USERNAME.BOB })
      .toString(),
    true
  );
  await alice1.clickOnElementAll(new DeleteContactModalConfirm(alice1));
  await Promise.all([
    alice1.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: bob.userName,
      maxWait: 500,
    }),
    alice2.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: bob.userName,
      maxWait: 500,
    }),
  ]);
}
