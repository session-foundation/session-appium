import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { AccountIDDisplay, ContinueButton } from './locators/global';
import {
  HideRecoveryPasswordButton,
  RecoveryPasswordMenuItem,
  UserSettings,
  YesButton,
} from './locators/settings';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Hide recovery password',
  risk: 'medium',
  testCb: hideRecoveryPassword,
  countOfDevicesNeeded: 2,
});

async function hideRecoveryPassword(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
  await linkedDevice(device1, device2, USERNAME.ALICE);
  await device1.clickOnElementAll(new UserSettings(device1));
  await device1.scrollDown();
  await device1.clickOnElementAll(new RecoveryPasswordMenuItem(device1));
  await device1.clickOnElementAll(new HideRecoveryPasswordButton(device1));
  // Wait for modal to appear
  // Check modal is correct
  await device1.checkModalStrings(
    tStripped('recoveryPasswordHidePermanently'),
    tStripped('recoveryPasswordHidePermanentlyDescription1')
  );
  // Click on continue
  await device1.clickOnElementAll(new ContinueButton(device1));
  // Check confirmation modal
  await device1.checkModalStrings(
    tStripped('recoveryPasswordHidePermanently'),
    tStripped('recoveryPasswordHidePermanentlyDescription2')
  );
  // Click on Yes
  await device1.clickOnElementAll(new YesButton(device1));
  // Has recovery password menu item disappeared?
  await device1.verifyElementNotPresent({
    ...new RecoveryPasswordMenuItem(device1).build(),
    maxWait: 1000,
  });
  // Should be taken back to Settings page after hiding recovery password
  await device1.onAndroid().scrollUp();
  await device1.waitForTextElementToBePresent(new AccountIDDisplay(device1));
  // Check that linked device still has Recovery Password
  await device2.clickOnElementAll(new UserSettings(device2));
  await device2.scrollDown();
  await device2.waitForTextElementToBePresent(new RecoveryPasswordMenuItem(device2));
  await closeApp(device1, device2);
}
