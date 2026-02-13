import test, { TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { PlusButton } from '../locators/home';
import { IOSTestContext } from '../utils/capabilities_ios';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { setIOSFirstInstallDate } from '../utils/time_travel';

// iOS uses app-level time override (customFirstInstallDateTime capability).
// Android would require system-level time manipulation (`adb root` + `toybox date`), which
// doesn't work on Play Store images (needed for future billing tests).
// Time manipulation through Android system UI is too brittle so these tests are iOS-only.

iosIt({
  title: 'Donate CTA shows if app installed >=7 days ago',
  risk: 'high',
  testCb: donateCTAShowsSevenDaysAgo,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Donations',
  },
  allureDescription:
    'Mocks a custom install date 7 days 2 minutes ago, opens the app, and verifies that the Donate CTA is shown.',
});

async function donateCTAShowsSevenDaysAgo(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const iosContext: IOSTestContext = {
    customInstallTime: setIOSFirstInstallDate({ days: -7, minutes: -2 }),
  };
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Donate CTA'), async () => {
    await device.checkCTA('donate');
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

iosIt({
  title: 'Donate CTA does not show if app installed <7 days ago',
  risk: 'high',
  testCb: donateCTADoesntShowSixDaysAgo,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Donations',
  },
  allureDescription:
    'Mocks a custom install date 6 days, 23 hours, and 58 minutes ago, opens the app, and verifies that the Donate CTA does not show.',
});

async function donateCTADoesntShowSixDaysAgo(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const iosContext: IOSTestContext = {
    customInstallTime: setIOSFirstInstallDate({ days: -6, hours: -23, minutes: -58 }),
  };
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step('Verify Donate CTA does not show', async () => {
    await Promise.all([
      device.waitForTextElementToBePresent(new PlusButton(device)),
      device.verifyNoCTAShows(),
    ]);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
