import { test } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CloseSettings } from '../locators';
import { ProSettingsEntry, ProSettingsEntryTitle, ProStatsHeader } from '../locators/pro';
import { UserSettings } from '../locators/settings';
import { forceStopAndRestart } from './utilities';

/**
 * Make a client notice a Pro grant that was minted server-side, and leave the app where it started.
 *
 * **A restart does not do this**, which is why every real-grant spec calls it. Each client gates its
 * cold-launch `get_pro_status` on already knowing it has access — an account with no local expiry and
 * no proof is deliberately never fetched for, since that is what stops a warning being raised off
 * unconfirmed state. A grant a client has never seen is exactly that account, so relaunching leaves it
 * non-Pro however many times it happens. The proof loop does not fill the gap either: it asks
 * libsession whether a renewal is due and makes no request at all when nothing is.
 *
 * Opening Pro settings fetches regardless, so it is the one route that works on all three platforms.
 * Desktop's equivalent is `DesktopWrapper.waitForProActive`.
 *
 * The stats section is the wait target rather than the screen itself: it renders only for an active
 * plan, so it separates "the fetch resolved and we are Pro" from "the Pro screen opened".
 */
export async function observeProGrant(device: DeviceWrapper): Promise<void> {
  await test.step('Let the client observe its Pro grant', async () => {
    // Restarted first so the visit's fetch is eligible, not because a restart discovers anything. A
    // launch fetches early, and a grant minted after that answers `never` — which then stands, because
    // both mobile clients floor further fetches at 60s from the last ATTEMPT and only the first fetch in
    // a process is unfloored.
    //
    // Measured rather than assumed: removing this still fails on Android after the cold-launch
    // config-change fetch was fixed, because onboarding fetches before the mint regardless.
    await forceStopAndRestart(device);

    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
    // `skipHealing` because this asserts a STATE, not the presence of a control. Healing falls back to
    // `findBestMatch`, a fuzzy match on the id, which on the non-Pro version of this screen resolves to
    // a neighbouring `pro-settings-*` element — so the wait passed while the client was NeverSubscribed
    // and every later Pro assertion ran against a non-Pro account.
    await device.waitForTextElementToBePresent({
      ...new ProStatsHeader(device).build(),
      skipHealing: true,
    });
    await device.navigateBack();
    // Back on the parent list, assert the row agrees. It reads the fetched STATUS where the stats
    // header above reads the active plan, and the two can disagree — a client can hold a good proof,
    // apply the Pro message cap, and still offer to sell you Pro here. Free to check: the row is on
    // screen anyway on the way out.
    await assertProFromSettingsRow(device);
  });
}

/**
 * Assert the client currently believes it is Pro, cheaply and without changing what it believes.
 *
 * Reads the Pro row's title on the **parent** settings screen, which no client refreshes on opening —
 * verified in source on all three, so this observes the status the client already held rather than
 * provoking a fetch that would answer the question being asked. The boundary is exact: the parent list
 * is passive, tapping the row is not, so this must read and leave.
 *
 * Distinct from asserting a Pro *feature* works. Feature gating reads the proof; this row reads the
 * fetched status, and a restore is where the two come apart.
 *
 * Leaves the app on the home screen. Expects settings to be open already.
 */
export async function assertProFromSettingsRow(device: DeviceWrapper): Promise<void> {
  await device.waitForTextElementToBePresent({
    ...new ProSettingsEntryTitle(device).build(),
    text: tStripped('sessionProBeta'),
  });
  await device.clickOnElementAll(new CloseSettings(device));
}
