import test, { type TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { User } from '../../types/testing';
import {
  LongPressBanAndDelete,
  LongPressBanUser,
  LongPressUnBan,
  MessageBody,
  MessageInput,
  OutgoingMessageStatusSent,
  SendButton,
} from './locators/conversation';
import { ConversationItem } from './locators/home';
import { assertAdminIsKnown, joinCommunity } from './utils/community';
import { newUser } from './utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { restoreAccount } from './utils/restore_account';

bothPlatformsIt({
  title: 'Ban and unban user in community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: banUserCommunity,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Ban/Unban',
  },
  allureDescription: `Verifies that a community admin can ban a user. 
    Banned user cannot send messages anymore.
    Admin then can unban a user and they can send messages again. `,
});

bothPlatformsIt({
  title: 'Ban and delete in community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: banAndDelete,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Ban/Unban',
  },
  allureDescription:
    'Verifies that a community admin can ban a user and delete their messages. Banned user cannot send messages anymore.',
});

async function banUserCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
  assertAdminIsKnown();
  const msgSig = `${new Date().getTime()} - ${platform}`;
  const msg1 = `Ban and unban me - ${msgSig}`;
  const msg2 = `Am I banned? - ${msgSig}`;
  const msg3 = `Freedom! - ${msgSig}`;
  const alice: User = {
    userName: 'Alice',
    accountID: '', // Mandatory property of User type but not needed for this test
    recoveryPhrase: process.env.SOGS_ADMIN_SEED!,
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
    await alice1.clickOnElementAll(new LongPressBanUser(alice1));
    // await alice1.checkModalStrings(
    //   englishStrippedStr('banUser').toString(),
    //   englishStrippedStr('communityBanDescription').toString()
    // );
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
  await test.step('Admin unbans Bob, Bob can send a third message', async () => {
    await alice1.longPressMessage(new MessageBody(alice1, msg1));
    await alice1.clickOnElementAll(new LongPressUnBan(alice1));
    await alice1.clickOnByAccessibilityID('Continue');
    await bob1.sendMessage(msg3);
    await alice1.waitForTextElementToBePresent(new MessageBody(alice1, msg3));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}

async function banAndDelete(platform: SupportedPlatformsType, testInfo: TestInfo) {
  assertAdminIsKnown();
  const msgSig = `${new Date().getTime()} - ${platform}`;
  const msg1 = `Ban and delete - ${msgSig}`;
  const msg2 = `Am I banned? - ${msgSig}`;
  const alice: User = {
    userName: 'Alice',
    accountID: '', // Mandatory property of User type but not needed for this test
    recoveryPhrase: process.env.SOGS_ADMIN_SEED!,
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
  await test.step('Admin bans Bob and deletes all from community', async () => {
    await alice1.longPressMessage(new MessageBody(alice1, msg1));
    await alice1.clickOnElementAll(new LongPressBanAndDelete(alice1));
    await alice1.checkModalStrings(
      englishStrippedStr('banDeleteAll').toString(),
      englishStrippedStr('communityBanDeleteDescription').toString()
    );
    await alice1.clickOnByAccessibilityID('Continue');
  });
  await test.step(`Verify Bob's first message has been deleted`, async () => {
    await alice1.verifyElementNotPresent({
      ...new MessageBody(alice1, msg1).build(),
      maxWait: 5_000,
    });
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
