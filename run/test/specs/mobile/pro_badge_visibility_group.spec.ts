import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { ProBadge } from '../../locators/pro';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge } from '../../utils/pro_badge';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';

const GROUP_NAME = 'Pro badge group';
const MESSAGE_BEFORE = 'Sending this one before I subscribe';
const MESSAGE_AFTER = 'Sending this one as a subscriber';

bothPlatformsIt({
  title: 'Pro badge shows in a group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  testCb: proBadgeVisibleInGroup,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A Pro subscriber sends a message to a group and the other members render their Pro badge beside ' +
    'the author name, which requires them to verify a real cryptographic proof.',
});

/**
 * The group counterpart of `pro_badge_visibility`, and it asserts a different element for a real
 * reason: a 1-to-1 renders the badge in the conversation **header** and never beside the message,
 * because the author label that carries it is group-only (`shouldShowAuthorName` guards on
 * `isGroupThread`). In a group it is the author label, so neither spec covers the other's surface.
 *
 * Like the 1-to-1 spec this needs a **real grant** rather than the launch-arg mocks. The mocks are
 * display-level and per-device: they persuade Alice's own client that she is Pro but produce no proof
 * for anyone else to verify, and the whole claim here is that Bob and Charlie verified one.
 *
 * The badge is driven by the **sender's profile** (`profile.proFeatures`), not by the message it
 * arrives with, so the control has to be taken before the grant rather than by comparing two messages
 * afterwards — once Alice's profile carries the badge, her earlier message renders it too.
 *
 * Asserted on `ProBadge` unscoped, which is safe in this fixture for the same reason it is in the 1-to-1
 * one: Alice is the only Pro member, so a badge on this screen can only be hers. The conversation
 * header has an identifier of its own (`conversation-header-pro-badge`), so it cannot be what matches.
 * Scope this if a fixture ever makes a second member Pro.
 */
async function proBadgeVisibleInGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: GROUP_NAME,
      focusGroupConvo: true,
      testInfo,
      testContext: PRO_BACKEND_CONTEXT,
    });
  });
  const { alice1, bob1, charlie1 } = devices;
  const { alice } = prebuilt;

  // The control, and the reason the assertion at the end means anything: the same locator on the same
  // screen, before Alice has anything to show. Without it a badge rendered unconditionally — or a
  // locator matching some other element — would pass the final step just as well.
  await test.step('Verify no badge before Alice subscribes', async () => {
    await alice1.sendMessage(MESSAGE_BEFORE);
    await bob1.waitForTextElementToBePresent(new MessageBody(bob1, MESSAGE_BEFORE));
    await bob1.verifyElementNotPresent({ ...new ProBadge(bob1).build(), maxWait: 1000 });
  });

  await test.step('Alice becomes a Pro subscriber', async () => {
    await makeAccountPro({ user: alice, platform });
    await observeProGrant(alice1);
  });

  await enableProBadge(alice1, platform);

  await test.step(TestSteps.SEND.MESSAGE(alice.userName, GROUP_NAME), async () => {
    // `observeProGrant` restarts the app, so the group is no longer the focused conversation.
    await alice1.clickOnElementAll(new ConversationItem(alice1, GROUP_NAME));
    await alice1.sendMessage(MESSAGE_AFTER);
  });

  // Both recipients, not just one: the badge is rendered from each device's own copy of Alice's
  // profile, so a second member is a second independent verification rather than a repeat of the first.
  await test.step('Verify both members see the badge', async () => {
    for (const device of [bob1, charlie1]) {
      await device.waitForTextElementToBePresent(new MessageBody(device, MESSAGE_AFTER));
      await device.waitForTextElementToBePresent(new ProBadge(device));
    }
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
