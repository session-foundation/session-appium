import { expect, test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { STANDARD_MAX_CHARS } from '../../../shared/constants';
import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { iosIt } from '../../../types/sessionIt';
import { MessageInput, OutgoingMessageStatusSent, SendButton } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';
import { readProStats } from '../../utils/pro_settings';

/**
 * The "Your Pro Stats" matrix, checked against usage the test itself produces.
 *
 * `pro_settings_states` already asserts the matrix is *there* per subscription state, and
 * `expectProStatsMatrix` asserts it reads zero on a fixture that has done nothing. Neither says the
 * numbers follow anything: a client that rendered four hard-coded zeroes, or wired every cell to the same
 * counter, satisfies both. This is the part that can only be shown by doing something and looking again.
 *
 * ## What breaks it
 *
 * Wiring any of the three cells to a constant, to the wrong feature bit, or to a counter the qualifying
 * action does not touch — including swapping the badges and longer-messages cells, which read adjacent
 * counters of the same shape — makes a post-action reading differ from `baseline + 1` and fails this.
 *
 * ## Why a real grant, not the launch-arg mocks
 *
 * Two of the three counters only move for a message that actually carried a Pro feature on the wire, and
 * both clients gate that on holding a **proof**, not on the plan's displayed state:
 * `ProStatusManager.addProFeatures` returns early unless `currentUserProProofForAccess() != null`
 * (Android), and `SessionProManager.attachProInfoIfNeeded` requires `currentUserProofIsValid`
 * (iOS). A display-level `proProof: 'valid'` makes the client's own UI behave as Pro but produces no
 * proof, so the feature bits are never stamped and these counters never move — the spec would fail
 * against a perfectly healthy app. Hence `makeAccountPro` plus `observeProGrant`.
 *
 * ## Why the deltas, and not the absolute numbers
 *
 * Because the absolute semantics are **not the same on all three clients**, and nothing specifies which
 * is right. Both send counters agree on "one qualifying send, one more", and diverge immediately after:
 *
 * | | Android | iOS | Desktop |
 * |---|---|---|---|
 * | badges sent / longer messages | live `COUNT(*)` over outgoing message rows carrying the feature bit (`MmsSmsDatabase`) | monotonic counter bumped in `handleSuccessfulMessageSend` | monotonic counter bumped in `models/message.ts` |
 * | deleting the message | decrements | no effect | no effect |
 * | a resend of a failed message | one row, so no change | counts again | counts again |
 *
 * So "how many badges have I sent" has no agreed answer, and an absolute assertion would pin the product
 * to whichever client the fixture happened to run on. `+1 for one qualifying action` is the part all three
 * do agree on, and it is checkable without knowing the rest. **The rest remains unspecified** — see the
 * PR for the list.
 *
 * `pinned-conversations` is the odd one out and the only one that is genuinely specified: all three read
 * a live count of threads currently pinned (Android over the libSession user configs, iOS and Desktop over
 * their local mirror of `pinnedPriority`), it needs no proof, and because the priority is config-backed it
 * is the one stat that really is the same on a user's other devices — which the header's own tooltip,
 * "Pro stats reflect usage on this device and may appear differently on linked devices", gets wrong.
 *
 * ## iOS-only, and what would make it `bothPlatformsIt`
 *
 * Android tags the cell but not the number. `ProStatItem` applies the `qaTag` to its root `Row`
 * (`session-android/app/src/main/java/org/thoughtcrime/securesms/preferences/prosettings/ProSettingsHomeScreen.kt`),
 * and `qaTag` is `semantics { testTagsAsResourceId = true }.testTag(…)` with no `mergeDescendants`, so
 * that node carries a `resource-id` and no text while the count sits on an untagged child `Text`. No `id`
 * or `accessibility id` reaches it, and the remaining strategies are not an option, so the Android half
 * would assert only that four cells exist — coverage that cannot fail. Tag that `Text` (the shape
 * `pro-screen-action-label` already uses for the same problem on the store-flow button) and this becomes
 * `bothPlatformsIt` with no change here beyond the platform guard in `readProStat`.
 *
 * Desktop is out for a stronger reason: it declares no `pro-stats-*` id at all.
 */
iosIt({
  title: 'Pro stats count real usage',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proStatsCountRealUsage,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A Pro subscriber sends one over-length message, one badged message and pins one conversation, and ' +
    'each action moves exactly its own Pro stats counter by one.',
});

/** One past the standard limit — the shortest message that carries the increased-length feature. */
const OVER_STANDARD_LENGTH = STANDARD_MAX_CHARS + 1;

/**
 * Send `body` in the conversation the device is already showing and wait for the sent tick.
 *
 * The tick, not the message bubble, is the signal this waits on: iOS increments its counters inside
 * `handleSuccessfulMessageSend`, so a reading taken when the bubble appears can race the write. It is also
 * what distinguishes a send from a refusal — an over-length message the client will not send raises a
 * modal and never ticks.
 *
 * Pasted rather than typed because the over-length case is 2001 characters, and unscoped because each of
 * these sends happens in a conversation of its own: with exactly one outgoing message in the thread there
 * is no earlier tick for the wait to match immediately.
 */
async function sendAndConfirm(device: DeviceWrapper, body: string): Promise<void> {
  await device.inputText(body, new MessageInput(device), true);
  await device.clickOnElementAll(new SendButton(device));
  await device.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(device).build(),
    maxWait: 50_000,
  });
}

async function proStatsCountRealUsage(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // One device: every counter under test is read from the sender's own client, so a running recipient
  // would add a simulator without adding a claim. The seeded contacts give the conversations to send in
  // and the one to pin.
  const { device, alice, contactNames } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_with_contacts({ platform, testInfo, iOSContext: IOS_PRO_CONTEXT });
  });

  // Two different conversations, so each send is the only outgoing message in its thread — see
  // `sendAndConfirm`. Pinning reuses the first, after both sends are done.
  const [longMessageRecipient, badgedMessageRecipient] = contactNames;

  await test.step('Alice becomes a Pro subscriber', async () => {
    await makeAccountPro({ user: alice, platform });
    await observeProGrant(device);
  });

  // Taken after the grant rather than before it: the matrix only renders for an active plan, so there is
  // nothing to read until the client has observed the grant. Read rather than assumed to be zero — the
  // claim is the delta, and a fixture that arrived with a pinned conversation should not fail this.
  const baseline = await readProStats(device);

  await test.step(`Send a ${OVER_STANDARD_LENGTH}-character message`, async () => {
    await device.clickOnElementAll(new ConversationItem(device, longMessageRecipient));
    await sendAndConfirm(device, 'x'.repeat(OVER_STANDARD_LENGTH));
    await device.navigateBack();
  });

  await test.step('Verify only the longer-messages counter moved', async () => {
    // The badge is off by default and has not been touched yet, so this send carries the increased-length
    // feature and nothing else. Asserting the whole reading, not just the cell that moved: a client that
    // counted every outgoing message would bump badges-sent here too, and a per-cell assertion would miss
    // it.
    expect(await readProStats(device)).toEqual({
      ...baseline,
      'longer-messages': baseline['longer-messages'] + 1,
    });
  });

  await enableProBadge(device, platform);

  await test.step('Send one short message with the badge on', async () => {
    await device.clickOnElementAll(new ConversationItem(device, badgedMessageRecipient));
    await sendAndConfirm(device, 'Badged');
    await device.navigateBack();
  });

  await test.step('Verify only the badges-sent counter moved', async () => {
    // Short, so it carries the badge and not the length feature — the mirror image of the send above, and
    // together they say the two cells read different bits rather than the same one twice.
    expect(await readProStats(device)).toEqual({
      ...baseline,
      'longer-messages': baseline['longer-messages'] + 1,
      'badges-sent': baseline['badges-sent'] + 1,
    });
  });

  await test.step(`Pin "${longMessageRecipient}"`, async () => {
    await device.pinConversation(longMessageRecipient);
  });

  await test.step('Verify only the pinned-conversations counter moved', async () => {
    // A different mechanism from the two above — a live count of currently-pinned threads rather than a
    // tally of sends — which is why it is worth the extra reading rather than being taken on trust.
    expect(await readProStats(device)).toEqual({
      ...baseline,
      'longer-messages': baseline['longer-messages'] + 1,
      'badges-sent': baseline['badges-sent'] + 1,
      'pinned-conversations': baseline['pinned-conversations'] + 1,
    });
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
