import test, { type TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { User } from '../../types/testing';
import {
  EmptyConversation,
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
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';
import { restoreAccount } from './utils/restore_account';

bothPlatformsIt({
  title: 'Ban and unban user in community - linked device',
  risk: 'medium',
  countOfDevicesNeeded: 3,
  testCb: banUnbanLinked,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Ban/Unban',
  },
  allureDescription: `Verifies that a community admin can ban a user. 
    The banned user cannot send a message.
    The banned account is restored on a second device. 
    Admin then unbans the user, and they can send messages on both devices.`,
});

bothPlatformsIt({
  title: 'Ban and delete in community - linked device',
  risk: 'medium',
  countOfDevicesNeeded: 3,
  testCb: banAndDeleteLinked,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Ban/Unban',
  },
  allureDescription: `Verifies that a community admin can ban a user and delete their messages.
    Then, restore the banned account on a second device. 
    The banned user cannot send messages anymore on either of their linked devices.`,
});

// Bob 1 + Bob 2 get banned by Alice the admin
async function banUnbanLinked(platform: SupportedPlatformsType, testInfo: TestInfo) {
  assertAdminIsKnown();
  const msgSig = `${new Date().getTime()} - ${platform}`;
  const msg1 = `Ban, link, unban - ${msgSig}`;
  const msg2 = `Am I banned? - ${msgSig}`;
  const msg3 = `You'll never catch me alive! - ${msgSig}`;
  const msg3Linked = `${msg3} - linked device`;
  const alice: User = {
    userName: 'Alice',
    accountID: '', // Mandatory property of User type but not needed for this test
    recoveryPhrase: process.env.SOGS_ADMIN_SEED!,
  };
  const {
    device1: alice1,
    device2: bob1,
    device3: bob2,
  } = await openAppThreeDevices(platform, testInfo);
  const [, bob] =
    await test.step('Restore admin account, create new account to be banned', async () => {
      return await Promise.all([restoreAccount(alice1, alice, 'alice1'), newUser(bob1, 'Bob')]);
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
    await alice1.clickOnByAccessibilityID('Continue');
  });
  await test.step('Verify Bob cannot send messages to community', async () => {
    await bob1.inputText(msg2, new MessageInput(bob1));
    await bob1.clickOnElementAll(new SendButton(bob1));
    await bob1.verifyElementNotPresent({
      ...new OutgoingMessageStatusSent(bob1).build(),
      maxWait: 10_000,
    });
    await alice1.verifyElementNotPresent(new MessageBody(alice1, msg2));
  });
  await test.step(TestSteps.SETUP.RESTORE_ACCOUNT('Bob'), async () => {
    await restoreAccount(bob2, bob, 'bob2');
    await bob2.clickOnElementAll(new ConversationItem(alice1, 'testing-all-the-things')); // Since we're banned we don't get the "real" name
    await bob2.waitForTextElementToBePresent(new EmptyConversation(bob2));
    await bob2.onIOS().waitForTextElementToBePresent({
      strategy: 'xpath',
      selector: `//XCUIElementTypeStaticText`,
      text: englishStrippedStr('permissionsWriteCommunity').toString(),
    });
  });
  await test.step('Admin unbans Bob, Bob can send a third message from both devices', async () => {
    await alice1.longPressMessage(new MessageBody(alice1, msg1));
    await alice1.clickOnElementAll(new LongPressUnBan(alice1));
    await alice1.clickOnByAccessibilityID('Continue');
    await Promise.all([bob1.sendMessage(msg3), bob2.sendMessage(msg3Linked)]);
    await Promise.all([
      alice1.waitForTextElementToBePresent(new MessageBody(alice1, msg3)),
      alice1.waitForTextElementToBePresent(new MessageBody(alice1, msg3Linked)),
    ]);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(bob1, alice1);
  });
}

// Bob 1 + Bob 2 get banned by Alice the admin
async function banAndDeleteLinked(platform: SupportedPlatformsType, testInfo: TestInfo) {
  assertAdminIsKnown();
  const msgSig = `${new Date().getTime()} - ${platform}`;
  const msg1 = `Ban and delete linked - ${msgSig}`;
  const msg2 = `Am I banned? - ${msgSig}`;
  const alice: User = {
    userName: 'Alice',
    accountID: '', // Mandatory property of User type but not needed for this test
    recoveryPhrase: process.env.SOGS_ADMIN_SEED!,
  };
  const {
    device1: alice1,
    device2: bob1,
    device3: bob2,
  } = await openAppThreeDevices(platform, testInfo);
  const [, bob] =
    await test.step('Restore admin account, create new account to be banned', async () => {
      return await Promise.all([restoreAccount(alice1, alice, 'alice1'), newUser(bob1, 'Bob')]);
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
    await alice1.clickOnByAccessibilityID('Continue');
  });
  await test.step(`Verify Bob's first message has been deleted`, async () => {
    await alice1.verifyElementNotPresent({
      ...new MessageBody(alice1, msg1).build(),
      maxWait: 5_000,
    });
  });
  await test.step(TestSteps.SETUP.RESTORE_ACCOUNT('Bob'), async () => {
    await restoreAccount(bob2, bob, 'bob2');
    await bob2.clickOnElementAll(new ConversationItem(alice1, 'testing-all-the-things')); // Since we're banned we don't get the "real" name
    await bob2.waitForTextElementToBePresent(new EmptyConversation(bob2));
  });
  await test.step('Verify Bob cannot send messages in community on either device', async () => {
    if (platform === 'android') {
      await Promise.all(
        [bob1, bob2].map(async device => {
          await device.inputText(msg2, new MessageInput(device));
          await device.clickOnElementAll(new SendButton(device));
          await device.verifyElementNotPresent({
            ...new OutgoingMessageStatusSent(device).build(),
            maxWait: 10_000,
          });
        })
      );
    } else {
      await bob1.inputText(msg2, new MessageInput(bob1));
      await bob1.clickOnElementAll(new SendButton(bob1));
      await bob1.verifyElementNotPresent({
        ...new OutgoingMessageStatusSent(bob1).build(),
        maxWait: 10_000,
      });
      await bob2.waitForTextElementToBePresent({
        strategy: 'xpath',
        selector: `//XCUIElementTypeStaticText`,
        text: englishStrippedStr('permissionsWriteCommunity').toString(),
      });
    }
    await alice1.verifyElementNotPresent(new MessageBody(alice1, msg2));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(bob1, alice1);
  });
}
