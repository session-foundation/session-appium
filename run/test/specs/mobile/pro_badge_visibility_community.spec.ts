import { test, type TestInfo } from '@playwright/test';

import { getCommunities } from '../../../constants/community';
import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { ProBadge } from '../../locators/pro';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { joinCommunity } from '../../utils/community';
import { perTestRoomsEnabled } from '../../utils/community_rooms';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';

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
 * The community counterpart of `pro_badge_visibility_group`, and it is a distinct claim rather than a
 * re-run of that one: a community message reaches the recipient through **SOGS**, from a **blinded**
 * sender, so the sender's own account key is not on the message at all. Everything the group spec
 * relies on — the sender's profile arriving over the swarm, the proof being checked against the key in
 * the sender's Account ID — is a different mechanism here, and the badge is the visible end of it.
 *
 * **A community message can carry a verifiable proof**, which is the first thing to establish since the
 * spec is worthless otherwise. libSession decodes community payloads through a dedicated entry point
 * that takes the Pro backend key and returns the verified Pro block with the plaintext — Android
 * `SessionProtocol.decodeForCommunity(payload, timestampMs, proBackendPubKey)` in `MessageParser.kt`,
 * iOS `session_protocol_decoded_community_message`'s `.pro` in `DecodedMessage.swift`. Blinding is not
 * an obstacle because the proof is signed by the **backend** over a rotating Pro key rather than bound
 * to the sender's Account ID, so there is nothing in it for SOGS's blinding to invalidate. Both clients
 * then write the decoded features onto the sender under their **blinded** address (Android
 * `ProfileUpdateHandler.handleProfileUpdate(..., fromCommunity)`; iOS the shared visible-message
 * handler), which is what the badge reads.
 *
 * Both clients render the surface, too. Android's author label is `ProBadgeText(..., showBadge =
 * message.recipient.shouldShowProBadge)` in `VisibleMessageView.kt`, in the same `Row` that appends the
 * blinded id for community senders; iOS's is `SessionLabelWithProBadge` in `VisibleMessageCell.swift`,
 * whose `isProBadgeHidden` reads `cellViewModel.profile.proFeatures`, next to the `threadVariant ==
 * .community` branch that appends the truncated author id. So a community author badge is a state both
 * clients can be in, not a hypothetical.
 *
 * Like the group and 1-to-1 specs this needs a **real grant** rather than the launch-arg mocks. The
 * mocks are display-level and per-device: they persuade Alice's own client that she is Pro but produce
 * no proof for anyone else to verify, and the whole claim here is that Bob verified one — over a
 * transport where he cannot even see who Alice is. Android could not be mocked into this state even if
 * that were acceptable: `resolveProStatus`'s `forceOtherUsersAsPro` branch is guarded on
 * `Address.Standard`, so it never reaches a blinded community sender.
 *
 * The badge is driven by the **sender's profile**, not by the message it arrives with, so the control
 * has to be taken before the grant rather than by comparing two messages afterwards — once Alice's
 * profile carries the badge, her earlier message renders it too.
 *
 * Which makes the step order load-bearing in a way that is worth stating, because getting it wrong
 * fails silently. Both clients drop an incoming profile whose `lastUpdateSeconds` has not advanced past
 * the copy they hold (Android `ProfileUpdateHandler.shouldUpdateProfile`, iOS `UpdateStatus.init`), and
 * the control message has already given Bob a copy of Alice's. The proof would then arrive, verify, and
 * be discarded one layer above — looking exactly like a badge that failed to render. What saves it is
 * that libSession stamps the profile on both writes this test makes: `UserProfile::set_pro_badge` and
 * `set_pro_config` each set `data["t"]/["T"] = ts_now()` (`src/config/user_profile.cpp`). So the grant
 * and `enableProBadge` must both land **between** the control and the second message, as below.
 *
 * ### Why the unscoped locator is safe here, and what makes it so
 *
 * Mobile tags the badge **structurally** (`pro-badge-icon`, on every badge in the app) rather than per
 * surface, so `ProBadge` cannot say *which* badge it matched — an unscoped match proves only "a badge
 * is on screen". Nor can it be scoped by traversal: Android's `ProBadgeText` takes a `badgeQaTag`
 * override precisely so a surface that needs its own id gets one at the call site (the conversation
 * header does), and deliberately rejects reaching the shared id from a parent. The message-author call
 * site passes no override, so there is nothing narrower to wait for on either platform.
 *
 * The group spec answers this by pointing at its fixture: closed membership, and Alice the only member
 * granted. **A community has no such membership**, which is exactly why this spec cannot simply repeat
 * that argument — on the shared remote community anyone posting could be Pro, and a badge on Bob's
 * screen would prove nothing about Alice.
 *
 * So the argument is *made to hold* instead of assumed: this test runs only in a room **it created**
 * (`communityRooms: 1` against a local SOGS), whose only posters are the room's seed identity and the
 * two seeded accounts. Alice is then the only member who can be Pro, and the group spec's reasoning
 * applies unchanged. When per-test rooms are off the run falls back to the shared remote community,
 * where that is untrue, so the test skips rather than asserting something it cannot attribute.
 *
 * That costs nothing in practice: a real grant already needs the Sesh-Net-Docker stack for
 * `TEST_PRO_BACKEND_URL`, and that same stack is what serves the local SOGS.
 *
 * Scope this — with a client-side `badgeQaTag`, not a traversal — if a fixture ever makes a second
 * member Pro.
 */
async function proBadgeVisibleInCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
    return await open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
      iOSContext: IOS_PRO_CONTEXT,
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
