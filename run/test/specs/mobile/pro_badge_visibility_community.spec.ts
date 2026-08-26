import { test, type TestInfo } from '@playwright/test';

import { getCommunities } from '../../../constants/community';
import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { ProBadge } from '../../locators/pro';
import { open_Alice1_Bob1_friends, open_Alice1_bob1_notfriends } from '../../state_builder';
import { joinCommunity } from '../../utils/community';
import { perTestRoomsEnabled } from '../../utils/community_rooms';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge } from '../../utils/pro_badge';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';

/**
 * The same claim between two accounts that ARE already contacts.
 *
 * Separated because the interesting variable is whether the recipient has already resolved the
 * sender's blinded community id to their real one. Android passes the sender address through
 * unmodified (`VisibleMessageHandler.kt`), so this is expected to pass here — while the Desktop
 * counterpart of this test is expected to FAIL, because Desktop writes the sender's Pro details to
 * the naked id whenever it knows it and the author label still reads the blinded one. If this ever
 * fails on a mobile client too, that client has adopted Desktop's bug.
 */
bothPlatformsIt({
  title: 'Pro badge shows in a community from a known contact',
  risk: 'high',
  countOfDevicesNeeded: 2,
  communityRooms: 1,
  testCb: (platform: SupportedPlatformsType, testInfo: TestInfo) =>
    proBadgeVisibleInCommunity(platform, testInfo, { asContacts: true }),
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'The community Pro badge for a sender the recipient already has as a contact — the case where ' +
    'the blinded sender id has a known real id behind it, which is where the clients diverge.',
});

bothPlatformsIt({
  title: 'Pro badge shows in a community',
  risk: 'high',
  countOfDevicesNeeded: 2,
  communityRooms: 1,
  testCb: proBadgeVisibleInCommunity,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A Pro subscriber posts to a community and another member renders their Pro badge beside the ' +
    'author name, which requires verifying a real cryptographic proof carried through SOGS by a ' +
    'blinded sender.',
});

/**
 * A Pro subscriber posts to a community and another member renders her badge beside the author name.
 * Distinct from the group spec: a community message arrives through SOGS from a BLINDED sender, so
 * the proof is verified and stored on a different path.
 *
 * Traps:
 * - Needs a REAL grant. The Pro mocks are display-level and per-device and produce no proof for the
 *   recipient to verify, which is the whole claim.
 * - The badge comes from the sender's PROFILE, not the message, so the control has to be taken before
 *   the grant — afterwards her earlier message renders a badge too.
 * - `ProBadge` is the shared `pro-badge-icon` and matches ANY badge on screen, so this is only
 *   attributable to Alice in a room nobody else posts to. Hence the per-test-room skip below. A
 *   client-side `message-author-pro-badge` tag would remove that constraint.
 */
async function proBadgeVisibleInCommunity(
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  { asContacts }: { asContacts: boolean } = { asContacts: false }
) {
  if (!perTestRoomsEnabled()) {
    test.skip(
      true,
      'Needs a community room this test created: `ProBadge` matches any badge on screen, so the ' +
        'assertion is only attributable to Alice in a room nobody else posts to. Set COMMUNITY_LINK ' +
        'and SOGS_ADMIN_SEED to a local SOGS — the same stack this spec already needs for the Pro ' +
        'backend.'
    );
  }

  const community = getCommunities().testCommunity;
  const signature = `${new Date().getTime()} - ${platform}`;
  const messageBefore = `Sending this one before I subscribe - ${signature}`;
  const messageAfter = `Sending this one as a subscriber - ${signature}`;

  const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return asContacts
      ? await open_Alice1_Bob1_friends({
          platform,
          focusFriendsConvo: false,
          testInfo,
          testContext: PRO_BACKEND_CONTEXT,
        })
      : await open_Alice1_bob1_notfriends({
          platform,
          testInfo,
          testContext: PRO_BACKEND_CONTEXT,
        });
  });
  const { alice1, bob1 } = devices;
  const { alice } = prebuilt;

  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await Promise.all(
      [alice1, bob1].map(device => joinCommunity(device, community.link, community.name))
    );
  });

  // The control, and the reason the assertion at the end means anything: the same locator on the same
  // screen, before Alice has anything to show. Without it a badge rendered unconditionally — or a
  // locator matching some other element — would pass the final step just as well. It doubles as the
  // check that this room really is empty of other Pro posters, since any badge here fails it.
  await test.step('Verify no badge before Alice subscribes', async () => {
    await alice1.sendMessage(messageBefore);
    await bob1.scrollToBottom();
    await bob1.waitForTextElementToBePresent(new MessageBody(bob1, messageBefore));
    await bob1.verifyElementNotPresent({ ...new ProBadge(bob1).build(), maxWait: 1000 });
  });

  await test.step('Alice becomes a Pro subscriber', async () => {
    await makeAccountPro({ user: alice, platform });
    await observeProGrant(alice1);
  });

  await enableProBadge(alice1, platform);

  await test.step(TestSteps.SEND.MESSAGE(alice.userName, community.name), async () => {
    // `observeProGrant` restarts the app, so the community is no longer the focused conversation.
    await alice1.clickOnElementAll(new ConversationItem(alice1, community.name));
    await alice1.sendMessage(messageAfter);
  });

  // Waiting on the message body first, not the badge: the badge travels with the profile on that
  // message, so asserting it first would be a race rather than a check.
  await test.step("Verify Bob sees Alice's badge in the community", async () => {
    await bob1.scrollToBottom();
    await bob1.waitForTextElementToBePresent(new MessageBody(bob1, messageAfter));
    await bob1.waitForTextElementToBePresent(new ProBadge(bob1));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
