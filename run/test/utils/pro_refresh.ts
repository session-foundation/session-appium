import { test } from '@playwright/test';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CloseSettings } from '../locators';
import { ProSettingsEntry, ProStatsHeader } from '../locators/pro';
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
    await device.clickOnElementAll(new CloseSettings(device));
  });
}
