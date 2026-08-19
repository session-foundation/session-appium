import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { ProSettingsEntry, ProStatsHeader } from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from '../../utils/open_app';
import { observeProGrant } from '../../utils/pro_refresh';

bothPlatformsIt({
  title: 'Pro survives a restore from seed',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proSurvivesRestore,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A subscriber who reinstalls and restores from their recovery phrase is still Pro on the ' +
    'restored install.',
});

/**
 * The reinstall case: pay, lose the install, restore, still Pro.
 *
 * A **real grant**, never a display mock. Pro-ness has to survive a device that has never seen it —
 * the restored install derives the Pro master key from the recovery phrase and asks the backend, so
 * this exercises that derivation end to end. A mock would only convince the device that already had
 * it, which is the opposite of what is being tested.
 *
 * The second device stands in for a reinstall rather than a linked device: nothing is carried across
 * from the first, only the phrase, which is exactly what a user has after losing their phone.
 */
async function proSurvivesRestore(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo, IOS_PRO_CONTEXT);

  const alice = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await newUser(device1, USERNAME.ALICE);
  });

  await test.step('Alice becomes a Pro subscriber', async () => {
    await makeAccountPro({ user: alice, platform });
    // Observed on device1 first so the restore has something synced to find: the expiry this writes to
    // config is what device2's own startup fetch is gated on.
    await observeProGrant(device1);
  });

  await test.step('Restore the account onto a device that has never seen it', async () => {
    await device2.restoreFromSeed(alice.seedPhrase);
    await device2.dismissCTA();
  });

  await test.step('Verify the restored install is Pro', async () => {
    await device2.clickOnElementAll(new UserSettings(device2));
    await device2.clickOnElementAll(new ProSettingsEntry(device2));
    // The stats section is gated on an active plan on both platforms, so its presence is the
    // restored client having fetched a real entitlement rather than merely rendering a Pro screen.
    await device2.waitForTextElementToBePresent(new ProStatsHeader(device2));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device1, device2);
  });
}
