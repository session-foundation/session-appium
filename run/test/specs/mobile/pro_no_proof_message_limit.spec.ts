import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { MessageInput, MessageLengthCountdown } from '../../locators/conversation';
import { PlusButton } from '../../locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from '../../locators/start_conversation';
import { iosActiveProContext } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';

/**
 * Comfortably past the standard cap of 2000, comfortably under the Pro one of 10000 — so the countdown
 * is shown under the limit this spec expects and absent under the one it does not.
 */
const OVER_STANDARD = 3000;

bothPlatformsIt({
  title: 'No Pro proof means no Pro message limit',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proNoProofMessageLimit,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A client that believes it is Pro but holds no proof offers only the standard message limit, ' +
    'because a recipient validates the extra length against a proof that would never arrive.',
});

/**
 * A client that believes it is Pro but holds no proof must not offer the Pro message limit.
 *
 * Pro *status* and a Pro *proof* answer different questions: the status is the plan's state, which only
 * the backend knows, while the proof is the entitlement that travels with the message and is what a
 * recipient validates against. A message length is the second question, so it has to read the proof.
 *
 * Read the status instead and the two ends disagree permanently: measured at 3000 characters sent and
 * 2000 stored by the recipient, with nothing shown at either end. The recipient truncates because no
 * proof arrived to justify the extra length, and the sender's own copy keeps the full text — so the
 * conversation holds two different messages and neither participant is told.
 *
 * The fixture needs no grant and no restore. A mocked active status supplies the status half while the
 * config stays empty, which is the state exactly: entitlement claimed, nothing to prove it with.
 */
async function proNoProofMessageLimit(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, {
    ...iosActiveProContext(),
    proLoadingState: 'success',
    // Overrides the shared context's `valid`, and the override IS the subject: this fixture is a plan
    // that reads active with nothing to prove it. Spread order matters — `iosActiveProContext` means
    // "an ordinary Pro user" and so grants both halves, where this spec needs exactly one.
    proProof: 'none',
  });

  const alice = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await newUser(device, USERNAME.ALICE);
  });

  await test.step('Verify the composer applies the standard limit', async () => {
    // Note to Self rather than a contact: the limit is the sender's own decision, so no second party is
    // needed to observe which one is being applied.
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new NewMessageOption(device));
    await device.inputText(alice.accountID, new EnterAccountID(device));
    // The keyboard covers Next on smaller screens. Do NOT swipe here: this is a bottom sheet, so a
    // scroll drags the sheet and the tap silently misses.
    await device.hideKeyboard();
    await device.clickOnElementAll(new NextButton(device));

    // The countdown reflects the limit the client is applying, so it fails here rather than after a
    // send, where the only evidence would be a length mismatch between two devices.
    await device.inputText('x'.repeat(OVER_STANDARD), new MessageInput(device), true);
    // Its PRESENCE is the assertion, not its value. The countdown only appears within 200 of the
    // limit, so at this length it is shown under the standard limit and absent under the Pro one —
    // which is exactly the question. Deliberately not matched on text: the remainder here is
    // four figures and each client abbreviates it differently (iOS renders `-1K`), so a literal
    // would assert the formatter rather than the limit.
    await device.waitForTextElementToBePresent(new MessageLengthCountdown(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
