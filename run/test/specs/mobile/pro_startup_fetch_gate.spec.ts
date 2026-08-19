import { test, type TestInfo } from '@playwright/test';

import { EXPIRING_SOON_ENTITLEMENT_SECONDS, makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { CTAButtonNegative, CTAHeading } from '../../locators/global';
import { ProSettingsEntry, ProStatsHeader } from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { forceStopAndRestart } from '../../utils/utilities';

bothPlatformsIt({
  title: 'Pro startup fetch gate arms the expiring soon CTA',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proStartupFetchGate,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A launch that cannot know it is expiring does not warn, and the launch after the client learns ' +
    'its access expiry does.',
});

/**
 * Both halves of the cold-launch status fetch, against a **real grant** — the one thing a display mock
 * cannot cover, since it satisfies the state without the fetch that decides whether to trust it.
 *
 * The client only goes to the network at launch when a CTA could fire, computed from the access expiry
 * in synced config. An account with no expiry and no proof is never fetched for, which is deliberate:
 * it is what stops a warning being raised off state the client has not confirmed.
 *
 * A grant minted straight into the backend is exactly that account, so the first launch must stay
 * silent. Opening Pro settings fetches regardless and stores the expiry, which is the state an in-app
 * purchase would have written — so the launch after it is a returning subscriber's, and must warn.
 */
async function proStartupFetchGate(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, IOS_PRO_CONTEXT);

  const alice = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await newUser(device, USERNAME.ALICE);
  });

  await test.step('Alice becomes a subscriber whose access is about to end', async () => {
    await makeAccountPro({
      user: alice,
      platform,
      durationSeconds: EXPIRING_SOON_ENTITLEMENT_SECONDS,
    });
  });

  await test.step('Verify a launch that cannot know it is expiring does not warn', async () => {
    await forceStopAndRestart(device);
    // Long enough that a fetch which DID happen would have answered — the point is that none was
    // made, and a short absence window would pass whether the gate held or not.
    await device.verifyElementNotPresent({ ...new CTAHeading(device).build(), maxWait: 15_000 });
  });

  await test.step('Teach the client its access expiry', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
    await device.waitForTextElementToBePresent(new ProStatsHeader(device));
  });

  await test.step('Verify the next launch warns', async () => {
    await forceStopAndRestart(device);
    await device.checkCTA('proExpiringSoon');
    // Dismissed through its own button rather than `dismissCTA()`, which taps at a coordinate that
    // does not close this modal — the next tap then lands on its scrim and the failure surfaces
    // somewhere unrelated.
    await device.clickOnElementAll(new CTAButtonNegative(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
