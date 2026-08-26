import { test, type TestInfo } from '@playwright/test';

import { animatedProfilePictureAsPng } from '../../../constants/testfiles';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { CloseSettings } from '../../locators';
import { UserAvatar } from '../../locators/settings';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { activeProContext, PRO_BACKEND_CONTEXT } from '../../utils/pro_context';

bothPlatformsIt({
  title: 'Animated file renamed to dodge the format gate (non Pro)',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: nonProFormatBypass,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A standard user is still stopped when the animated file is renamed to a static extension, which ' +
    'is only true of a client reading the bytes rather than the name.',
});

bothPlatformsIt({
  title: 'Animated file renamed to dodge the format gate (Pro)',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proFormatBypass,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'The control for the standard-user case: the same file uploads and animates for a subscriber, so ' +
    'the fixture really is animated.',
});

/**
 * The mobile half of "does the animated-display-picture gate read the file or its name".
 *
 * The fixture is the animated GIF the other avatar specs use, byte for byte, under a `.png` name. A
 * client that decides "is this animated?" from the extension lets a standard user upload it — and the
 * picture then animates for everyone, because what recipients render is the file rather than the
 * sender's claim about it.
 *
 * `uploadProfilePicture(false, ...)` is deliberate: `false` describes what the PICKER is expected to
 * show — an ordinary image, with a crop step — while the file handed to it is animated. The whole
 * question is whether the app agrees with the picker or with the bytes.
 *
 * 🔴 That expectation is the unverified part. If a platform's picker sniffs content it will present
 * this as a GIF, the image-name locator will not match, and the setup fails before the assertion. That
 * is a fixture problem rather than a product one, and the fix is `true` for that platform.
 */
async function nonProFormatBypass(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, PRO_BACKEND_CONTEXT);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step(TestSteps.USER_ACTIONS.CHANGE_PROFILE_PICTURE, async () => {
    await device.uploadProfilePicture(false, animatedProfilePictureAsPng);
    // Reached only if the client inspected the bytes. If it trusted the extension there is no CTA, the
    // upload succeeds, and a standard user is wearing an animated display picture.
    await device.checkCTA('animatedProfilePicture');
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * The control for the case above.
 *
 * Without it, "the CTA appeared" is also satisfied by a client that refuses every `.png` it is handed,
 * and the spec would pass while proving nothing about animation detection.
 *
 * Mocked Pro rather than a real grant: what is under test is a rendering decision about a local file,
 * with no proof crossing the wire, and the mock avoids the status-refresh race a fresh account hits.
 */
async function proFormatBypass(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, activeProContext());
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await device.dismissCTA();

  await test.step(TestSteps.USER_ACTIONS.CHANGE_PROFILE_PICTURE, async () => {
    await device.uploadProfilePicture(false, animatedProfilePictureAsPng);
    await device.verifyNoCTAShows();
    // The picture the recipient specs depend on: the bytes really do animate, so a standard user being
    // stopped above is the gate working rather than the file being unremarkable.
    await device.verifyElementIsAnimated(new UserAvatar(device));
    await device.clickOnElementAll(new CloseSettings(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
