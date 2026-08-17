import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { CloseSettings } from '../../locators';
import { MessageInput, MessageLengthCountdown } from '../../locators/conversation';
import { CTAButtonNegative } from '../../locators/global';
import { PlusButton } from '../../locators/home';
import {
  ProManageSectionHeader,
  ProRenewPlanRow,
  ProSettingsDescription,
  ProSettingsEntry,
  ProStatsHeader,
} from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { EnterAccountID, NewMessageOption, NextButton } from '../../locators/start_conversation';
import { harvestAccountData, newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';

const PRO_MAX_CHARS = 10000;
const COUNTDOWN_START_THRESHOLD = 200;
/** Lands the countdown on exactly the threshold, so the value asserted is the limit being applied. */
const AT_PRO_THRESHOLD = PRO_MAX_CHARS - COUNTDOWN_START_THRESHOLD;

const ONE_DAY_SECONDS = 24 * 60 * 60;

bothPlatformsIt({
  title: 'Pro features survive the plan expiring',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proOverhang,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A lapsed plan whose proof still has time left displays as expired while the features keep ' +
    'working, because access comes from the proof and the displayed state comes from the plan.',
});

/**
 * The one disagreement between the two Pro values that is a feature.
 *
 * Access comes from the proof; the displayed state comes from the plan. When a plan lapses the proof
 * does not expire with it, so there is a window where the client shows "expired" and still serves every
 * Pro feature — deliberate, and the reason the two values exist separately at all.
 *
 * Asserted together in one spec on purpose. Each half alone is satisfied by a client that has collapsed
 * the two values back into one: a client reading only the proof shows Active and passes the feature
 * check, and a client reading only the plan shows expired and passes the display check. Only the pair
 * fails for a client that has lost the distinction, which is the regression worth catching — it is
 * silent, and it takes a paid-for feature away from someone who is still entitled to it.
 *
 * The expired half comes from a CONFIRMED status rather than from a seeded one. Seeding it off a past
 * access expiry reaches a similar-looking screen by a different route — the client has no response, so
 * it offers to RECOVER a plan it cannot see rather than to renew one it knows has lapsed — correct for
 * that state, and a different one. The overhang is a plan we have been TOLD is over, so the fixture
 * supplies that.
 */
async function proOverhang(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, {
    sessionProEnabled: 'true',
    // The plan ended yesterday, and the backend has said so...
    proBackendStatus: 'expired',
    proLoadingState: 'success',
    proAccessExpiry: String(Math.floor(Date.now() / 1000) - ONE_DAY_SECONDS),
    // ...while the credential it was issued under is still good.
    proProof: 'valid',
  });

  // `saveUserData: false` skips the settings visit `newUser` otherwise makes to read the recovery
  // phrase. That visit happens before any spec code can run, so a fixture which arms an app-open CTA —
  // as this one does — has the modal sitting over the settings list while it looks for a row.
  await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await newUser(device, USERNAME.ALICE, { saveUserData: false });
  });

  await test.step('Verify the expiry CTA fires on app open', async () => {
    // The first half of the display claim, and it has to be handled before anything else regardless:
    // the modal covers the UI, so a spec that ignored it would fail several steps later on whatever it
    // happened to be obscuring.
    await device.checkCTA('proExpired');
    // Dismissed through its own Cancel button rather than `dismissCTA()`, which falls back to a tap at
    // (150,150) — that does not dismiss this modal on iOS and the next tap then lands on its scrim.
    await device.clickOnElementAll(new CTAButtonNegative(device));
  });

  // Both halves run in the SAME launch deliberately: the claim is that one client holds both states at
  // once, which a relaunch between them would not show.
  let accountID = '';

  await test.step('Verify the plan displays as expired', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
    await device.waitForTextElementToBePresent(new ProRenewPlanRow(device));
    // The copy is asserted, not just the row, because the two are chosen by different code. The row
    // follows the plan's status; the description is picked by a separate switch on that same status,
    // so a client that fixed one and not the other offers to renew under a heading thanking the user
    // for subscribing. The expired copy is also the only one of the three that tells someone in this
    // window what to do about it, which is the whole point of showing an expired plan to a user whose
    // features still work.
    await device.waitForTextElementToBePresent(
      new ProSettingsDescription(device, tStripped('proAccessRenewStart'))
    );
    // Asserted absent as well: the subscribed screen renders these, so their presence would mean the
    // client is showing an active plan rather than an expired one with working features.
    await device.verifyElementNotPresent({
      ...new ProStatsHeader(device).build(),
      maxWait: 1000,
    });
    await device.verifyElementNotPresent({
      ...new ProManageSectionHeader(device).build(),
      maxWait: 1000,
    });
    await device.navigateBack();
    await device.clickOnElementAll(new CloseSettings(device));
  });

  await test.step('Read the account address', async () => {
    // Deferred until after the CTA was handled, which is why `newUser` skipped it: the modal sits over
    // the settings list, and this reads it.
    ({ accountID } = await harvestAccountData(device, USERNAME.ALICE));
  });

  await test.step('Verify the Pro message limit still applies', async () => {
    // Note to Self: the limit is the sender's own decision, so no second party is needed to observe
    // which one is in force.
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new NewMessageOption(device));
    await device.inputText(accountID, new EnterAccountID(device));
    await device.hideKeyboard();
    await device.clickOnElementAll(new NextButton(device));

    // At this length the countdown reads 200 under the Pro limit and would have appeared thousands of
    // characters ago under the standard one, so the value names which limit is being applied.
    await device.inputText('x'.repeat(AT_PRO_THRESHOLD), new MessageInput(device), true);
    await device.waitForTextElementToBePresent(
      new MessageLengthCountdown(device, String(COUNTDOWN_START_THRESHOLD))
    );
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
