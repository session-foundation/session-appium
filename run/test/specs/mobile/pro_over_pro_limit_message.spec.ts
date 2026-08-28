import { test, type TestInfo } from '@playwright/test';

import {
  MESSAGE_DELIVERY_TIMEOUT_MS,
  PRO_MAX_CHARS,
  STANDARD_MAX_CHARS,
} from '../../../shared/constants';
import { boundary, early, late, OVER_PRO_LIMIT_CHARS, overflow } from '../../../shared/message';
import { sendOverProLimitMessage } from '../../../shared/pro_message';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_Bob0_friends } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';

const TAG = 'OVERPRO';

bothPlatformsIt({
  title: `A ${OVER_PRO_LIMIT_CHARS}-character message from a Pro sender`,
  risk: 'high',
  testCb: overProLimitMessage,
  countOfDevicesNeeded: 1,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A recipient cuts a message one character over the Pro character limit at exactly the limit, ' +
    'rather than keeping it whole, dropping it or falling back to the standard limit.',
});

/**
 * A body no compliant client will ever send, and what the recipient does with it.
 *
 * `STANDARD_MAX_CHARS` and `PRO_MAX_CHARS` are both enforced in the composer, so every other limit spec
 * is written from the SENDER's side. One character past the Pro limit cannot be reached that way at all,
 * which left the receiving side of the rule untested; the seeder's `sendProMessage` manufactures it, and
 * consults no limit while doing so.
 *
 * The sender has to be genuinely Pro rather than mocked, because the recipient verifies the arriving
 * proof before it will honour anything past `STANDARD_MAX_CHARS`. A mocked sender's message arrives cut
 * at the standard limit, and the spec would then be asserting the wrong refusal.
 *
 * Bob gets no device: he is an account the seeder acts as. Alice is an ordinary, non-Pro account —
 * the limit applied to an incoming body is decided by the SENDER's proof, not the reader's plan.
 *
 * All three clients agree here, and only because the body is plain ASCII. Android and Desktop truncate
 * by code point, iOS by UTF-16 unit, so a non-BMP body would land at 10,000 on two clients and 5,000 on
 * the third (`MessageReceiver+VisibleMessages.swift`, and the FIXME already sitting on it). That is a
 * real divergence and a different spec; do not reach for emoji here.
 */
async function overProLimitMessage(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device, alice, bob, network } = await open_Alice1_Bob0_friends({
    platform,
    testInfo,
    // Mandatory: the QA backend's key is what libSession verifies Bob's proof against. On the default
    // key the proof reads as invalid, the body is cut at the standard limit, and the failure looks like
    // a client bug rather than a missing override.
    testContext: PRO_BACKEND_CONTEXT,
  });

  await test.step('Seed a message one character past the Pro limit', async () => {
    // Sent with Alice's app already up, so her poll is seconds behind the mint. A proof that dies
    // before the message is parsed is read as no proof at all.
    await sendOverProLimitMessage({ from: bob, to: alice, network, tag: TAG });
  });

  await test.step('Wait for it to arrive', async () => {
    await device.clickOnElementAll(new ConversationItem(device, bob.userName));
    device.log(`Waiting up to ${MESSAGE_DELIVERY_TIMEOUT_MS}ms for "${early(TAG)}" to arrive`);
    await device.waitForMessageContaining(early(TAG), MESSAGE_DELIVERY_TIMEOUT_MS);
    // Mandatory before reading any later marker: a collapsed bubble is indistinguishable from a
    // truncated one, so without this every absence below is satisfied by a message that is merely folded.
    await device.expandLongMessages();
    device.log('Expanded any folded bubble — every marker below reads the stored body');
  });

  await test.step('The recipient cuts the body at exactly the Pro limit', async () => {
    device.log(`Looking for "${late(TAG)}", past the standard limit of ${STANDARD_MAX_CHARS}`);
    if (!(await device.findMessageContaining(late(TAG)))) {
      throw new Error(
        `${alice.userName}'s copy stops inside the standard limit of ${STANDARD_MAX_CHARS}, ` +
          `so this client did not honour ${bob.userName}'s proof. Either the proof failed to verify ` +
          `(check the Pro backend key this device was launched with) or it expired before the message ` +
          `was parsed.`
      );
    }
    device.log(`Looking for "${boundary(TAG)}", which ends on ${PRO_MAX_CHARS}`);
    if (!(await device.findMessageContaining(boundary(TAG)))) {
      throw new Error(
        `${alice.userName}'s copy is missing the marker ending at ${PRO_MAX_CHARS}, so this ` +
          `client cut the body short of the Pro limit while still honouring the proof.`
      );
    }
    // The pair above and this one are what pin the length: `boundary` ends at PRO_MAX_CHARS and
    // `overflow` is `boundary` plus the one character past it, so only a body of exactly PRO_MAX_CHARS
    // satisfies both.
    device.log(`Making sure "${overflow(TAG)}" is absent, the character past ${PRO_MAX_CHARS}`);
    if (await device.findMessageContaining(overflow(TAG))) {
      throw new Error(
        `${alice.userName} kept the character past ${PRO_MAX_CHARS}, so this client stored ` +
          `all ${OVER_PRO_LIMIT_CHARS} characters ${bob.userName} sent. The limit is not enforced on ` +
          `receive.`
      );
    }
  });
  await closeApp(device);
}
