import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { BlockUser, BlockUserConfirmationModal } from './locators';
import { BlockedBanner, ConversationSettings } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Unblock user',
  risk: 'low',
  testCb: unblockUser,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Block/Unblock',
  },
  allureDescription: 'Verifies that a user can be unblocked after being blocked',
});

async function unblockUser(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const blockedMessage = `Blocked message from ${bob.userName} to ${alice.userName}`;
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new BlockUser(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('block').toString(),
    englishStrippedStr('blockDescription').withArgs({ name: bob.userName }).toString()
  );
  await alice1.clickOnElementAll(new BlockUserConfirmationModal(alice1));
  await alice1.navigateBack();
  const blockedStatus = await alice1.waitForTextElementToBePresent({
    ...new BlockedBanner(alice1).build(),
    maxWait: 5000,
  });
  if (blockedStatus) {
    alice1.info(`${bob.userName} has been blocked`);
  } else {
    alice1.info('Blocked banner not found');
  }
  // Send message from Blocked User
  await bob1.sendMessage(blockedMessage);
  await alice1.verifyElementNotPresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: blockedMessage,
    maxWait: 5000,
  });
  // Now that user is blocked, unblock them
  await alice1.clickOnElementAll(new BlockedBanner(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('blockUnblock').toString(),
    englishStrippedStr('blockUnblockName').withArgs({ name: bob.userName }).toString()
  );
  await alice1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Unblock' });
  await alice1.verifyElementNotPresent({ ...new BlockedBanner(alice1).build(), maxWait: 2000 });
}
