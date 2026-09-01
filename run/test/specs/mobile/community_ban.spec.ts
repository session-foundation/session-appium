import type { StateUser } from '@session-foundation/qa-seeder';

import test, { type TestInfo } from '@playwright/test';

import { getCommunities } from '../../../constants/community';
import { tStripped } from '../../../localizer/lib';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  LongPressBanAndDelete,
  LongPressBanUser,
  LongPressUnBan,
  MessageBody,
  MessageInput,
  OutgoingMessageStatusFailedToSend,
  SendButton,
} from '../../locators/conversation';
import {
  assertAdminIsKnown,
  joinCommunity,
  leaveCommunity,
  openOrJoinCommunity,
} from '../../utils/community';
import { newUser } from '../../utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from '../../utils/open_app';
import { restoreAccount } from '../../utils/restore_account';

bothPlatformsIt({
  title: 'Ban and unban user in community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  communityRooms: 1,
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
  communityRooms: 1,
  testCb: banAndDelete,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Ban/Unban',
  },
  allureDescription:
    'Verifies that a community admin can ban a user and delete their messages. Banned user cannot send messages anymore.',
});

async function banUserCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const communities = getCommunities();
  assertAdminIsKnown();
  const msgSig = `${new Date().getTime()} - ${platform}`;
  const msg1 = `Ban and unban me - ${msgSig}`;
  const msg2 = `Am I banned? - ${msgSig}`;
  const msg3 = `Freedom! - ${msgSig}`;
  const alice: StateUser = {
    userName: 'Alice',
    // Mandatory on StateUser but unused here: the SOGS admin is identified by its seed alone.
    sessionId: '05',
    seed: new Uint8Array(),
    seedPhrase: process.env.SOGS_ADMIN_SEED!,
  };
  const { device1: alice1, device2: bob1 } = await openAppTwoDevices(platform, testInfo);
  const [, bob] =
    await test.step('Restore admin account, create new account to be banned', async () => {
      return Promise.all([
        restoreAccount(alice1, alice, 'alice1'),
        newUser(bob1, 'Bob', { saveUserData: false }),
      ]);
    });
  try {
    await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
      await openOrJoinCommunity(
        alice1,
        communities.testCommunity.link,
        communities.testCommunity.name
      );
      await joinCommunity(bob1, communities.testCommunity.link, communities.testCommunity.name);
    });
    await test.step(TestSteps.SEND.MESSAGE('Bob', 'community'), async () => {
      await bob1.sendMessage(msg1);
    });
    await test.step('Admin bans Bob from community', async () => {
      await alice1.longPressMessage(new MessageBody(alice1, msg1));
      await alice1.clickOnElementAll(new LongPressBanUser(alice1));
      await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Ban User'), async () => {
        await alice1.checkModalStrings(
          tStripped('banUser'),
          tStripped('communityBanUserDescription', { name: bob.userName })
        );
      });
      await alice1.clickOnByAccessibilityID('Continue');
    });
    await test.step('Verify Bob cannot send messages in community', async () => {
      await bob1.inputText(msg2, new MessageInput(bob1));
      await bob1.clickOnElementAll(new SendButton(bob1));
      await bob1.waitForTextElementToBePresent(new OutgoingMessageStatusFailedToSend(bob1));
      await alice1.verifyElementNotPresent(new MessageBody(alice1, msg2));
    });
    await test.step('Admin unbans Bob, Bob can send a third message', async () => {
      await alice1.longPressMessage(new MessageBody(alice1, msg1));
      await alice1.clickOnElementAll(new LongPressUnBan(alice1));
      await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Unban User'), async () => {
        await alice1.checkModalStrings(
          tStripped('banUnbanUser'),
          tStripped('communityUnbanUserDescription', { name: bob.userName })
        );
      });
      await alice1.clickOnByAccessibilityID('Continue');
      await bob1.sendMessage(msg3);
      await alice1.waitForTextElementToBePresent(new MessageBody(alice1, msg3));
    });
  } finally {
    // In a finally rather than a step: Playwright abandons remaining steps once a test fails, so a
    // step-based leave ran only on PASSING tests - the exact inverse of what is needed. It is the FAILED
    // test whose community stays in the shared admin's config, and one dead room there holds that server's
    // poller at its 30s retry cap on the next run, which turned a single failure into a permanent
    // alternating one. Before `closeApp`, because it drives the UI.
    await leaveCommunity(alice1, communities.testCommunity.name);
  }

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}

async function banAndDelete(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const communities = getCommunities();
  assertAdminIsKnown();
  const msgSig = `${new Date().getTime()} - ${platform}`;
  const msg1 = `Ban and delete - ${msgSig}`;
  const msg2 = `Am I banned? - ${msgSig}`;
  const alice: StateUser = {
    userName: 'Alice',
    // Mandatory on StateUser but unused here: the SOGS admin is identified by its seed alone.
    sessionId: '05',
    seed: new Uint8Array(),
    seedPhrase: process.env.SOGS_ADMIN_SEED!,
  };
  const { device1: alice1, device2: bob1 } = await openAppTwoDevices(platform, testInfo);
  await test.step('Restore admin account, create new account to be banned', async () => {
    await Promise.all([
      restoreAccount(alice1, alice, 'alice1'),
      newUser(bob1, 'Bob', { saveUserData: false }),
    ]);
  });
  try {
    await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
      await openOrJoinCommunity(
        alice1,
        communities.testCommunity.link,
        communities.testCommunity.name
      );
      await joinCommunity(bob1, communities.testCommunity.link, communities.testCommunity.name);
    });
    await test.step(TestSteps.SEND.MESSAGE('Bob', 'community'), async () => {
      await bob1.sendMessage(msg1);
    });
    await test.step('Admin bans Bob and deletes all from community', async () => {
      await alice1.longPressMessage(new MessageBody(alice1, msg1));
      await alice1.clickOnElementAll(new LongPressBanAndDelete(alice1));
      await alice1.checkModalStrings(
        tStripped('banDeleteAll'),
        tStripped('communityBanDeleteDescription')
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
      await bob1.waitForTextElementToBePresent(new OutgoingMessageStatusFailedToSend(bob1));
      await alice1.verifyElementNotPresent(new MessageBody(alice1, msg2));
    });
  } finally {
    // In a finally rather than a step: Playwright abandons remaining steps once a test fails, so a
    // step-based leave ran only on PASSING tests - the exact inverse of what is needed. It is the FAILED
    // test whose community stays in the shared admin's config, and one dead room there holds that server's
    // poller at its 30s retry cap on the next run, which turned a single failure into a permanent
    // alternating one. Before `closeApp`, because it drives the UI.
    await leaveCommunity(alice1, communities.testCommunity.name);
  }

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
