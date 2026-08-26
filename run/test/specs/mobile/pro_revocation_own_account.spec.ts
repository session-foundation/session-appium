import { test, type TestInfo } from '@playwright/test';

import { OVER_STANDARD_CHARS } from '../../../shared/message';
import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageInput, MessageLengthCountdown } from '../../locators/conversation';
import { CTAButtonNegative } from '../../locators/global';
import { PlusButton } from '../../locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from '../../locators/start_conversation';
import { open_Alice1 } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

bothPlatformsIt({
  title: 'A refund revokes Pro from the account itself, not just its plan',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proRevocationOwnAccount,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A refunded account stops applying the Pro message limit to itself, because the revocation kills ' +
    'the proof rather than merely ending the plan — unlike a plan that simply lapses.',
});

/**
 * The matched pair to the overhang spec, and the only case where a client has to police its OWN
 * credential.
 *
 * `Pro features survive the plan expiring` establishes that a lapsed plan does NOT stop the features:
 * access comes from the proof, the proof outlives the plan, and the client keeps serving every Pro
 * feature while displaying an expired plan. That is deliberate.
 *
 * A refund has to break that. Revoking the payments rotates the account onto a fresh generation, which
 * puts the proof the client is still holding on the revocation list — so the credential is dead rather
 * than merely unrenewed, and the features have to stop. Getting this wrong is invisible from the
 * outside: the client would keep composing at the Pro limit against a proof every recipient rejects,
 * which is the two-ends disagreement `No Pro proof means no Pro message limit` describes.
 *
 * The composer's limit is the whole claim. The status side cannot carry it: after a refund the plan
 * reads inactive and the Pro stats header is gone, which is what the overhang spec asserts for a plan
 * that merely lapsed, so nothing on the Pro settings screen separates the two cases.
 *
 * A real grant, not a mock. The mocks are display-level, so there would be no proof for a revocation to
 * invalidate and the spec would assert the mock's own behaviour. `PRO_BACKEND_CONTEXT` deliberately supplies
 * only the backend and its pubkey — no mocked status, no mocked proof.
 *
 * One device throughout. The limit is the sender's own decision, so unlike the recipient-facing
 * revocation specs there is no second party whose verification is the subject.
 */
async function proRevocationOwnAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Seeded because the mint derives the Pro master key from the recovery phrase, which a seeded account
  // already carries.
  const { device, alice } = await open_Alice1({
    platform,
    testInfo,
    testContext: {
      ...PRO_BACKEND_CONTEXT,
      // A precondition, not a convenience. The backend serves the production cadence — `retry_in: 86400`,
      // inside libSession's [60s, 48h] clamp — so a client's second revocation poll is a day after its
      // first. Without this the client never learns of the refund inside the run and the final assertion
      // would pass on a client that had simply not looked.
      forceProRevocationRefresh: true,
    },
  });

  await test.step('Give the account real Pro and let it notice', async () => {
    await makeAccountPro({ user: alice, platform });
    // Restarts, opens Pro settings so the fetch is eligible, and waits for the stats header — which
    // renders only for an active plan, so it separates "we are Pro" from "the Pro screen opened". This
    // is the status-side control: the header asserted here is the one asserted absent at the end.
    await observeProGrant(device);
  });

  // The control the whole spec rests on. "The composer applies the standard limit" is satisfied
  // perfectly by a grant that never worked, so the Pro limit has to be observed FIRST. Note to Self
  // rather than a contact, since the limit is the sender's own decision.
  await test.step('Verify the composer applies the Pro limit while the proof is good', async () => {
    await openNoteToSelfComposer(device, alice.sessionId);
    await device.inputText('x'.repeat(OVER_STANDARD_CHARS), new MessageInput(device), true);
    // Absence is the assertion. The countdown appears only within 200 of the limit, so at this length
    // it is absent under the Pro limit and shown under the standard one.
    await device.verifyElementNotPresent({
      ...new MessageLengthCountdown(device).build(),
      maxWait: 2000,
    });
  });

  await test.step('Refund the account', async () => {
    // `revokePayments` is what makes this a refund rather than the rotation the recipient-facing specs
    // use: it strips the entitlement as well as rotating the generation, so the client is left holding a
    // proof that is both unrenewable and revoked.
    await revokeAccountPro({ user: alice, revokePayments: true });
    // Forces the poll. Also rebuilds the composer, which on iOS is what re-reads the limit.
    await forceStopAndRestart(device);
    // The refund can raise the Pro upsell over the home screen, where it swallows the taps that follow
    // and surfaces as a missing account-ID field several screens from the cause.
    //
    // Dismissed rather than asserted: it is raised off the status the client has fetched, so whether it
    // is up when the home screen renders races the poll, and it is equally absent on an account that is
    // still subscribed.
    const upsell = await device.doesElementExist({
      ...new CTAButtonNegative(device).build(),
      maxWait: 5000,
    });
    if (upsell) {
      await device.clickOnElementAll(new CTAButtonNegative(device));
    }
  });

  await test.step('Verify the composer has dropped back to the standard limit', async () => {
    await openNoteToSelfComposer(device, alice.sessionId);
    // The composer is empty: nothing is sent here, so neither the conversation nor its draft survives
    // the restart. iOS clears a field through the "Select All" menu, which an empty field cannot raise.
    await device.inputText('x'.repeat(OVER_STANDARD_CHARS), new MessageInput(device), true);
    // The claim: the client is applying the standard limit to itself, because the proof it holds has
    // been revoked. Its presence, not its value — the remainder is four figures here and each client
    // abbreviates it differently, so a literal would assert the formatter rather than the limit.
    await device.waitForTextElementToBePresent(new MessageLengthCountdown(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * Open the composer against the account's own conversation, from the home screen.
 *
 * Driven through the new-conversation flow both times rather than tapping a list item, so it does not
 * depend on whether the conversation survived the restart — nothing is ever sent here, and a
 * conversation with no messages is not reliably listed.
 */
async function openNoteToSelfComposer(device: DeviceWrapper, sessionId: string) {
  await device.clickOnElementAll(new PlusButton(device));
  await device.clickOnElementAll(new NewMessageOption(device));
  await device.inputText(sessionId, new EnterAccountID(device));
  // The keyboard covers Next on smaller screens. Do NOT swipe: this is a bottom sheet, so a scroll drags
  // the sheet and the tap silently misses.
  await device.hideKeyboard();
  await device.clickOnElementAll(new NextButton(device));
}
