import test, { type TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { User } from '../../types/testing';
import {
  MessageBody,
  MessageInput,
  OutgoingMessageStatusSent,
  SendButton,
} from './locators/conversation';
import { ConversationItem } from './locators/home';
import { newUser } from './utils/create_account';
import { joinCommunity } from './utils/join_community';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { restoreAccount } from './utils/restore_account';

androidIt({
  title: 'Ban user in community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: banUserCommunity,
});

async function banUserCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
  if (!process.env.SOGS_ADMIN_SEED) {
    throw new Error(
      'SOGS_ADMIN_SEED required. In CI this is a GitHub secret.\nLocally, set a known admin seed as an env var to run this test.'
    );
  }
  const msgSig = `${new Date().getTime()} - ${platform}`;
  const msg1 = `Ban me - ${msgSig}`;
  const msg2 = `Am I banned? - ${msgSig}`;
  const alice: User = {
    userName: 'Alice',
    accountID: '', // Mandatory property of User type but not needed for this test
    recoveryPhrase: process.env.SOGS_ADMIN_SEED,
  };
  const { device1: alice1, device2: bob1 } = await openAppTwoDevices(platform, testInfo);
  await test.step('Restore admin account, create new account to be banned', async () => {
    await Promise.all([
      restoreAccount(alice1, alice, 'alice1'),
      newUser(bob1, 'Bob', { saveUserData: false }),
    ]);
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    const adminJoined = await alice1.doesElementExist(
      new ConversationItem(alice1, testCommunityName)
    );
    if (!adminJoined) {
      await joinCommunity(alice1, testCommunityLink, testCommunityName);
    } else {
      await alice1.clickOnElementAll(new ConversationItem(alice1, testCommunityName));
      await alice1.scrollToBottom();
    }
    await joinCommunity(bob1, testCommunityLink, testCommunityName);
  });
  await test.step(TestSteps.SEND.MESSAGE('Bob', 'community'), async () => {
    await bob1.sendMessage(msg1);
  });
  await test.step('Admin bans Bob from community', async () => {
    await alice1.longPressMessage(new MessageBody(alice1, msg1));
    await alice1.clickOnElementAll({
      strategy: 'id',
      selector: 'network.loki.messenger:id/context_menu_item_title',
      text: englishStrippedStr('banUser').toString(),
    });
    await alice1.checkModalStrings(
      englishStrippedStr('banUser').toString(),
      englishStrippedStr('communityBanDescription').toString()
    );
    await alice1.clickOnByAccessibilityID('Continue');
  });
  await test.step('Verify Bob cannot send messages in community', async () => {
    await bob1.inputText(msg2, new MessageInput(bob1));
    await bob1.clickOnElementAll(new SendButton(bob1));
    await bob1.verifyElementNotPresent({
      ...new OutgoingMessageStatusSent(bob1).build(),
      maxWait: 10_000,
    });
    await alice1.verifyElementNotPresent(new MessageBody(alice1, msg2));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
