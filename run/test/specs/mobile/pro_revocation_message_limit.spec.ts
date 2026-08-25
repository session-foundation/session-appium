import { test, type TestInfo } from '@playwright/test';

import { MESSAGE_DELIVERY_TIMEOUT_MS, STANDARD_MAX_CHARS } from '../../../shared/constants';
import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { early, late, LATE_AT, markedMessage } from '../../../shared/pro_revocation';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageInput, SendButton } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

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
    testContext: { ...PRO_BACKEND_CONTEXT, forceProRevocationRefresh: true },
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
    // Mandatory: a collapsed copy is indistinguishable from a truncated one, which fails the control
    // and passes the truncation assertion regardless of what the recipient actually stored.
    await bob1.expandLongMessages();
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
    await bob1.expandLongMessages();
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
