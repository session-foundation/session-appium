import { test, type TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { getCommunities } from '../../../constants/community';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationPinnedIcon, PlusButton } from '../../locators/home';
import { joinCommunities } from '../../utils/community';
import { assertPinOrder, getConversationOrder } from '../../utils/conversation_order';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';

/** The pinned-conversation limit for a standard account. */
const STANDARD_PIN_LIMIT = 5;
const COMMUNITY_COUNT = 6;
const PLAN_DAYS = 30;
const ONE_DAY_SECONDS = 24 * 60 * 60;

bothPlatformsIt({
  title: 'An active plan with no proof is refused without being sold to',
  risk: 'high',
  countOfDevicesNeeded: 1,
  communityRooms: COMMUNITY_COUNT,
  testCb: proSilentRefusal,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A client whose plan reads active but which holds no usable proof refuses a Pro action and shows ' +
    'no upgrade prompt, because it cannot offer a subscription the user is already paying for.',
});

/**
 * Refused, and not sold to.
 *
 * The gate is an ACCESS question — no usable proof, so the action cannot be allowed. The prompt is a
 * DISPLAY question — the plan reads active, so offering to sell Pro would be offering something the user
 * already has. The two answers come from different values, and this is the state where they differ.
 *
 * The refusal is therefore SILENT, which is a deliberate trade rather than an oversight: no copy exists
 * for "your plan is active but we cannot verify it yet", and the alternatives are worse — a purchase
 * prompt aimed at a subscriber, or a wrong explanation. This spec exists to hold that in place. A client
 * that "fixes" the silence by reinstating the upsell fails here, which is the whole point: the fix looks
 * like an improvement at the call site and is the bug the split was made to remove.
 *
 * Both halves are asserted. A CTA appearing is not the same as the action being refused, and an action
 * being refused is not the same as no CTA appearing — an implementation that showed the prompt and pinned
 * anyway satisfies either assertion alone.
 */
async function proSilentRefusal(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const communities = getCommunities();
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, {
      sessionProEnabled: 'true',
      // The plan says active, with time left on it...
      proBackendStatus: 'active',
      proLoadingState: 'success',
      // Not optional. An `active` status with no expiry inherits zero, which the client reads as
      // expiring imminently and covers the screen with the expiring-soon CTA — documented on the field
      // itself, and it takes down every step after it rather than the one that caused it.
      proAccessExpiry: String(Math.floor(Date.now() / 1000) + PLAN_DAYS * ONE_DAY_SECONDS),
      // ...and there is nothing to prove it with.
      proProof: 'none',
    });
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step('Verify no prompt is raised at launch', async () => {
    // A plan with time left is not expiring and not lapsed, so nothing here has anything to say — and a
    // client that upsold on the strength of the missing proof would say it here first.
    await device.verifyNoCTAShows();
  });

  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITIES(COMMUNITY_COUNT), async () => {
    await joinCommunities(device, COMMUNITY_COUNT);
  });

  let beforeOrder: string[] = [];
  await test.step('Capture conversation order before pinning', async () => {
    beforeOrder = await getConversationOrder(device);
  });

  const toPin = Object.values(communities)
    .slice(0, STANDARD_PIN_LIMIT)
    .map(community => community.name);
  const overLimit = Object.values(communities)[STANDARD_PIN_LIMIT].name;

  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(STANDARD_PIN_LIMIT), async () => {
    // The standard limit applies, because the limit is ACCESS. Pinning up to it must not prompt either.
    for (const name of toPin) {
      await device.pinConversation(name);
      await device.waitForTextElementToBePresent(new PlusButton(device));
      await device.verifyNoCTAShows();
      await device
        .onAndroid()
        .waitForTextElementToBePresent(new ConversationPinnedIcon(device, name));
    }
  });

  await test.step('Verify the over-limit pin is refused with no prompt', async () => {
    await device.pinConversation(overLimit);
    // The assertion that carries this spec: the standard-account version of this step shows the
    // pinned-conversations CTA here, and this state must not.
    await device.verifyNoCTAShows();
  });

  await test.step('Verify the over-limit conversation was NOT pinned', async () => {
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
