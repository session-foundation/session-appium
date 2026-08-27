import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ProSettingsEntry, ProStatsHeader } from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { ALICE_IS_PRO, open_Alice1 } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { assertProFromSettingsRow } from '../../utils/pro_refresh';

bothPlatformsIt({
  title: 'Pro is granted to a seeded account',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proGrantedToSeededAccount,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'An account seeded with Pro access, granted a real entitlement before it is ever restored, is Pro ' +
    'as soon as the restore completes — with nothing prompting the client to look.',
});

/**
 * The mobile counterpart of desktop's `pro_seeded_access_grant`, and the one spec that states the
 * cold-launch gate works.
 *
 * Every other real-grant spec calls `observeProGrant`, which restarts the client and walks it into Pro
 * settings — a screen that fetches unconditionally. That is a deliberate workaround, so none of them
 * can say whether the client would ever have noticed on its own. This one can, because
 * `open_Alice1_pro` seeds the access expiry the gate reads and mints the entitlement *before* the
 * restore.
 *
 * The assertion order is the whole design:
 *
 * 1. The Pro row on the **parent** settings list, which no client refreshes on opening. Reading it
 *    observes what the client already believed, so passing here means the gated startup fetch ran and
 *    resolved with no help from the test.
 * 2. Only then the stats section, which renders for an ACTIVE PLAN — so it separates a client that
 *    fetched a status from one holding a proof the backend really signed.
 *
 * Opening Pro settings for (2) provokes a fetch, so it could stand alone only as "the client can be
 * made Pro". (1) is what makes it "the client became Pro by itself", and it has to come first.
 */
async function proGrantedToSeededAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await open_Alice1({
      platform,
      testInfo,
      testContext: PRO_BACKEND_CONTEXT,
      stateOptions: ALICE_IS_PRO,
    });
  });

  await test.step('Verify the client already believes it is Pro', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    // Reads and leaves — see `assertProFromSettingsRow`. Deliberately not `observeProGrant`: that
    // would restart and open Pro settings, which is exactly the prompting this spec exists to avoid.
    await assertProFromSettingsRow(device);
  });

  await test.step('Verify the entitlement is real', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
    // `skipHealing` for the reason `observeProGrant` gives: healing's fuzzy id match resolves to a
    // neighbouring `pro-settings-*` element on the non-Pro screen, so the wait would pass while the
    // account was NeverSubscribed.
    await device.waitForTextElementToBePresent({
      ...new ProStatsHeader(device).build(),
      skipHealing: true,
    });
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
