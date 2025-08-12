import type { TestInfo } from '@playwright/test';

import { USERNAME } from '@session-foundation/qa-seeder';

import { bothPlatformsIt } from '../../types/sessionIt';
import { UsernameSettings } from './locators';
import { AccountIDDisplay } from './locators/global';
import { UserSettings } from './locators/settings';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Link device',
  risk: 'high',
  testCb: linkDevice,
  countOfDevicesNeeded: 2,
});

async function linkDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Open server and two devices
  const { device1: alice1, device2: alice2 } = await openAppTwoDevices(platform, testInfo);
  // link device
  const alice = await linkedDevice(alice1, alice2, USERNAME.ALICE);
  // Check that 'Youre almost finished' reminder doesn't pop up on alice2
  await alice2.verifyElementNotPresent({
    strategy: 'accessibility id',
    selector: 'Recovery phrase reminder',
    maxWait: 1000,
  });
  // Verify username and session ID match
  await alice2.clickOnElementAll(new UserSettings(alice2));
  // Check username
  await alice2.waitForTextElementToBePresent({
    ...new UsernameSettings(alice2).build(),
    text: alice.userName,
  });
  await alice2.waitForTextElementToBePresent(new AccountIDDisplay(alice2,alice.accountID));
  await closeApp(alice1, alice2);
}
