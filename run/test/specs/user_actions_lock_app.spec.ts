import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { PlusButton } from '../locators/home';
import { LockAppOption, LockAppToggle, PrivacyMenuItem, UserSettings } from '../locators/settings';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { forceStopAndRestart, runScriptAndLog } from '../utils/utilities';

// `xcrun simctl` doesn't support adding a pin like adb does so this is an Android only test
androidIt({
  title: 'Lock app',
  risk: 'high',
  testCb: lockApp,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Settings',
    suite: 'Privacy',
  },
  allureDescription:
    'Verifies the app can be locked with a PIN and that the system lock screen appears on app launch when enabled.',
});

async function lockApp(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const pin = '12345678';
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  try {
    await test.step('Set device PIN', async () => {
      await runScriptAndLog(`adb -s ${device.udid} shell locksettings set-pin ${pin}`, true);
    });
    await test.step('Enable app lock', async () => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new PrivacyMenuItem(device));
      await device.clickOnElementAll(new LockAppOption(device));
      await device.assertAttribute(new LockAppToggle(device), 'checked', 'true');
    });
    await test.step('Force stop and restart app', async () => {
      await forceStopAndRestart(device, false);
      // The unlock screen is not visible to appium
      // This is basically a blind sleep before entering PIN to avoid a partial pin entry
      await device.verifyElementNotPresent({ ...new PlusButton(device).build(), maxWait: 3_000 });
    });
    await test.step('Enter PIN to unlock app', async () => {
      await runScriptAndLog(`adb -s ${device.udid} shell input text ${pin}`, true);
      await runScriptAndLog(`adb -s ${device.udid} shell input keyevent 66`, true);
    });
    await test.step('Verify home screen is visible', async () => {
      await device.waitForTextElementToBePresent(new PlusButton(device));
    });
    await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
      await closeApp(device);
    });
  } finally {
    await runScriptAndLog(`adb -s ${device.udid} shell locksettings clear --old ${pin}`, true);
  }
}
