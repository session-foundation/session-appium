import { test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { sleepFor } from '../../../shared/promise_utils';
import { TestSteps } from '../../../types/allure';
import { androidIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { PlusButton } from '../../locators/home';
import {
  LockAppOption,
  LockAppToggle,
  PrivacyMenuItem,
  UserSettings,
} from '../../locators/settings';
import { getAdbFullPath } from '../../utils/binaries';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { forceStopAndRestart, runScriptAndLog } from '../../utils/utilities';

/**
 * Wait until Android's device-credential prompt has taken focus.
 *
 * The unlock screen is not in Appium's view, which is why the check here used to be "the home screen's
 * PlusButton is GONE". That is true both when the prompt is up AND when the app has not finished
 * launching, so it cannot tell them apart — and a PIN typed on the strength of it goes nowhere. The
 * failure then surfaces as a missing home screen 30s later, nowhere near the cause.
 *
 * `dumpsys window` can see what Appium cannot: the prompt holds focus as `BiometricPrompt` (measured on
 * the API 34 emulator image this suite uses, where it stayed focused for ~35s). Waiting for it turns an
 * ambiguous absence into positive evidence that there is something there to type into.
 */
async function waitForDeviceCredentialPrompt(
  device: DeviceWrapper,
  maxWait: number = 60_000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const focus = await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell dumpsys window | grep -m1 mCurrentFocus`
    );
    if (focus.includes('BiometricPrompt')) {
      device.log('Device credential prompt has focus');
      return;
    }
    await sleepFor(1_000);
  }

  throw new Error(`Device credential prompt did not take focus within ${maxWait}ms`);
}

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
      await runScriptAndLog(
        `${getAdbFullPath()} -s ${device.udid} shell locksettings set-pin ${pin}`,
        true
      );
    });
    await test.step('Enable app lock', async () => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new PrivacyMenuItem(device));
      await device.clickOnElementAll(new LockAppOption(device));
      await device.assertAttribute(new LockAppToggle(device), 'checked', 'true');
    });
    await test.step('Force stop and restart app', async () => {
      await forceStopAndRestart(device, false);
      await waitForDeviceCredentialPrompt(device);
    });
    await test.step('Enter PIN to unlock app', async () => {
      await runScriptAndLog(`${getAdbFullPath()} -s ${device.udid} shell input text ${pin}`, true);
      await runScriptAndLog(`${getAdbFullPath()} -s ${device.udid} shell input keyevent 66`, true);
    });
    await test.step('Verify home screen is visible', async () => {
      await device.waitForTextElementToBePresent(new PlusButton(device));
    });
    await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
      await closeApp(device);
    });
  } finally {
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell locksettings clear --old ${pin}`,
      true
    );
  }
}
