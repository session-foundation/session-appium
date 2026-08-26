import { expect, test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { messageOfLength, OVER_STANDARD_CHARS } from '../../../shared/message';
import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageInput, OutgoingMessageStatusSent, SendButton } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge } from '../../utils/pro_badge';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { readProStats } from '../../utils/pro_settings';

/**
 * The "Your Pro Stats" matrix, checked against usage the test itself produces. Sibling specs assert the
 * matrix renders and reads zero; neither would catch four hard-coded zeroes or two cells wired to the
 * same counter.
 *
 * Traps:
 * - Needs a REAL grant. Both send counters only move for a message that carried a Pro feature on the
 *   wire, and both clients gate that on holding a proof — a display-level mock stamps no feature bits,
 *   so the counters never move and the spec fails against a healthy app.
 * - Asserts DELTAS, not absolutes. The clients disagree on the absolute semantics: Android recounts
 *   outgoing rows (so deleting a message decrements), iOS and Desktop bump a monotonic counter (so a
 *   resend counts twice). "+1 per qualifying action" is the only part all three agree on.
 * - Every reading is a fresh visit to the screen — see `readProStats`.
 *
 * `pinned-conversations` is the exception: a live count of currently-pinned threads on all three, needs
 * no proof, and being config-backed it really is the same across a user's devices.
 */
bothPlatformsIt({
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
    return await open_Alice1_with_contacts({
      platform,
      testInfo,
      testContext: PRO_BACKEND_CONTEXT,
    });
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

  await test.step(`Send a ${OVER_STANDARD_CHARS}-character message`, async () => {
    await device.clickOnElementAll(new ConversationItem(device, longMessageRecipient));
    await sendAndConfirm(device, messageOfLength(OVER_STANDARD_CHARS));
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
