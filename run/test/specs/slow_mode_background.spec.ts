import test, { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { BackgroundPermsAllowButton } from './locators/home';
import { newUser } from './utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
  uninstallApp,
} from './utils/open_app';

androidIt({
  title: 'Slow mode background perms modal',
  risk: 'medium',
  testCb: slowModeBackgroundModal,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Settings',
    suite: 'Notifications',
  },
  allureDescription:
    'Verifies the slow mode background permissions modal appears, accepting it shows the system dialog.',
});

async function slowModeBackgroundModal(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, {
      saveUserData: false,
      fastMode: false,
    });
    return { device };
  });
  try {
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Background Permissions'), async () => {
      await device.checkModalStrings(
        tStripped('runSessionBackground'),
        tStripped('runSessionBackgroundDescription')
      );
      await device.clickOnElementAll(new BackgroundPermsAllowButton(device));
      await device.clickOnElementAll({
        strategy: 'id',
        selector: 'android:id/button1',
        text: 'Allow',
      });
    });
    // The test ends here since there is no good way to verify that the specific toggle is ON.
  } finally {
    // App must be uninstalled to prevent state pollution (background permission is tied to app install)
    await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
      await closeApp(device);
      await uninstallApp(device, platform);
    });
  }
}
