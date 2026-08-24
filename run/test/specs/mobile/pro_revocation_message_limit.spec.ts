import { test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import {
  COUNTDOWN_START_THRESHOLD,
  MESSAGE_DELIVERY_TIMEOUT_MS,
  PRO_MAX_CHARS,
  STANDARD_MAX_CHARS,
} from '../../../shared/constants';
import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageInput, MessageReadMore, SendButton } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

const EARLY_AT = 500;
const LATE_AT = STANDARD_MAX_CHARS + 500;
const TOTAL = PRO_MAX_CHARS - COUNTDOWN_START_THRESHOLD;

const early = (tag: string) => `EARLY-${tag}`;
const late = (tag: string) => `LATE-${tag}`;

/** See the desktop spec: the markers straddle the standard limit, and that is checked, not trusted. */
function markedMessage(tag: string): string {
  const head = 'a'.repeat(EARLY_AT) + early(tag);
  const withLate = head + 'b'.repeat(LATE_AT - head.length) + late(tag);
  const message = withLate + 'c'.repeat(TOTAL - withLate.length);

  const earlyEnd = message.indexOf(early(tag)) + early(tag).length;
  const lateStart = message.indexOf(late(tag));
  if (
    message.length !== TOTAL ||
    earlyEnd > STANDARD_MAX_CHARS ||
    lateStart <= STANDARD_MAX_CHARS
  ) {
    throw new Error(
      `markedMessage(${tag}): ${message.length} chars, EARLY ends ${earlyEnd}, LATE starts ${lateStart} ` +
        `— the markers must straddle the standard limit of ${STANDARD_MAX_CHARS}.`
    );
  }
  return message;
}

/**
 * Expand every collapsed bubble, and it is MANDATORY rather than tidiness.
 *
 * A collapsed bubble shows only its leading portion, which can be indistinguishable from what a recipient
 * that refused the proof would have stored. So an un-expanded conversation cannot tell the two apart: the
 * control would fail even when the proof was honoured, and the truncation assertion would pass even when it
 * was not. Both directions wrong, from the same cause.
 *
 * The platforms collapse by different rules — Android by line count (`MAX_COLLAPSED_LINE_COUNT = 25`), not
 * by characters — so an assertion phrased as "collapsed means exactly `STANDARD_MAX_CHARS`" would be
 * testing something Android does not do. Assert on the EXPANDED text and the difference stops mattering.
 *
 * Opportunistic per bubble, because whether there is anything to expand is itself information: a copy cut
 * to the standard limit may present no affordance at all.
 *
 * ANDROID ONLY, and the gate lives here rather than at the call sites so it cannot be forgotten by a third
 * one: iOS flattens the bubble into a single accessibility element, so there is no Read more subview to
 * find and `MessageReadMore` throws on iOS by design. Nothing is lost by skipping it — the full text is in
 * the bubble's accessibility attributes whether or not the bubble is visually collapsed, which is exactly
 * what the assertions below read.
 */
async function expandLongMessages(device: DeviceWrapper): Promise<void> {
  if (device.isIOS()) {
    return;
  }

  for (let i = 0; i < 4; i++) {
    const readMore = await device.doesElementExist({
      ...new MessageReadMore(device).build(),
      maxWait: 5_000,
    });
    if (!readMore) {
      return;
    }
    try {
      await device.clickOnElementAll(new MessageReadMore(device));
    } catch {
      // The affordance vanished between the check and the click — the bubble re-renders as it expands,
      // so this races by construction. Best-effort is the contract: what matters is that no collapsed
      // bubble is left hiding the tail, and the assertions that follow say whether one was.
      return;
    }
  }
}

bothPlatformsIt({
  title: 'A revoked proof does not buy the Pro message limit at the recipient',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proRevocationMessageLimit,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A recipient honours the Pro character limit for a valid proof and applies the standard limit once ' +
    "that proof is revoked, truncating the sender's oversized message at receipt.",
});

/**
 * A revoked proof does not buy the Pro message limit at the recipient.
 *
 * The spec for the defect the revocation work uncovered: the receive path chose a message's Pro features
 * from the bitset the message declared, without asking whether the proof behind it had been revoked — so
 * a revoked sender kept the higher character limit on every recipient, indefinitely. Fixed on Android by
 * clearing the bitset at the parser, which makes every downstream reader conform at once.
 *
 * 🔴 **The control comes first and is what makes the rest mean anything.** The recipient chooses its limit
 * from its own stored record of the sender, so one that never knew the sender as Pro truncates for an
 * innocent reason. Bob storing 9,800 characters while the proof is good rules that out.
 *
 * 🔴 **The order is the opposite of `pro_revocation_recipient`'s.** The badge is re-evaluated live, so
 * revoking after a message still clears it. This decision is made once, at receipt, and the truncated body
 * is persisted — so the revocation must land before the second message is parsed.
 *
 * Alice is deliberately not restarted, so she never learns of the revocation and keeps sending with the
 * dead credential. Her own copies keep their full text, because truncation is receive-side — which is also
 * why asserting only the sender would pass with the fix reverted.
 */
async function proRevocationMessageLimit(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    // Not focused: every step here starts from the conversation list, and a relaunch returns there anyway.
    focusFriendsConvo: false,
    testInfo,
    testContext: { ...IOS_PRO_CONTEXT, forceProRevocationRefresh: true },
  });
  const { alice1, bob1 } = devices;

  await test.step('Grant Pro and let the client observe it', async () => {
    await makeAccountPro({ user: prebuilt.alice, platform });
    await observeProGrant(alice1);
  });

  const honoured = markedMessage('HONOURED');
  await test.step('Send an oversized message while the proof is good', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.inputText(honoured, new MessageInput(alice1), true);
    await alice1.clickOnElementAll(new SendButton(alice1));
  });

  await test.step('The control: the recipient keeps all of it', async () => {
    await bob1.clickOnElementAll(new ConversationItem(bob1, prebuilt.alice.userName));
    await expandLongMessages(bob1);
    await bob1.waitForMessageContaining(late('HONOURED'), MESSAGE_DELIVERY_TIMEOUT_MS);
  });

  await test.step("Revoke Alice's generation and let Bob learn of it", async () => {
    await revokeAccountPro({
      user: prebuilt.alice,
      revokePayments: false,
      effectiveInSeconds: 0,
    });
    // The relaunch is what forces Bob's poll: the backend serves a 24h cadence, so waiting is not an
    // option. It also returns him to the conversation list, hence the reopen below.
    await forceStopAndRestart(bob1);
  });

  const refused = markedMessage('REFUSED');
  await test.step('Send another oversized message with the dead proof', async () => {
    // Leave and re-enter before pasting again. A second paste into a composer that has already sent one
    // finds no "Paste" item in the edit menu — measured on iOS, where the first paste succeeds and the
    // second waits 30s and fails. Re-entering rebuilds the input view, and costs a fraction of that.
    await alice1.navigateBack();
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.inputText(refused, new MessageInput(alice1), true);
    await alice1.clickOnElementAll(new SendButton(alice1));
  });

  await test.step('The recipient applies the standard limit', async () => {
    await bob1.clickOnElementAll(new ConversationItem(bob1, prebuilt.alice.userName));
    // The newest message first, and this is load-bearing: the accessibility tree only carries RENDERED
    // nodes, and the expanded first message is 9,800 characters tall — enough to push the second one out
    // of the viewport entirely. Measured: the matcher saw exactly one body, the expanded first message,
    // and reported the second as never having arrived.
    await bob1.scrollToBottom();
    await expandLongMessages(bob1);
    // `EARLY` first: it proves the message arrived, so the absence of `LATE` can only mean it was cut.
    await bob1.waitForMessageContaining(early('REFUSED'), MESSAGE_DELIVERY_TIMEOUT_MS);
    const kept = await bob1.findMessageContaining(late('REFUSED'));
    if (kept) {
      throw new Error(
        `${prebuilt.bob.userName} kept text from beyond the standard limit (${late('REFUSED')} sits at ` +
          `${LATE_AT}, past ${STANDARD_MAX_CHARS}), so this client honoured the Pro limit for a sender ` +
          `whose proof was revoked. Its copy should have been cut at ${STANDARD_MAX_CHARS} characters.`
      );
    }
  });

  await closeApp(alice1, bob1);
}
