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
 * The fixture is an animated GIF under a `.png` name: the colour inverse of the GIF the other avatar
 * specs use. The inversion is load-bearing on iOS, where the file is chosen out of the photo picker by
 * matching its pixels — an identical twin in the same library is picked between by tree order alone,
 * and the two share a picker label as well, so nothing else separates them. A
 * client that decides "is this animated?" from the extension lets a standard user upload it — and the
 * picture then animates for everyone, because what recipients render is the file rather than the
 * sender's claim about it.
 *
 * The first argument to `uploadProfilePicture` describes what the PICKER shows, not what the file is,
 * and [PICKER_SHOWS_IT_AS_ANIMATED] is why it has to be per-platform.
 */
/**
 * Whether the OS picker gives this file away before the app ever sees it.
 *
 * The two pickers disagree about the same bytes, which was measured rather than assumed:
 *
 *   - **iOS** lists it as a photo (`Photo taken on …`), going by the `.png` name.
 *   - **Android** lists it as `GIF taken on …`, with a `icon_gif` badge — its media store reads the
 *     header. A first run asking for the photo label hung on the picker with nothing to tap.
 *
 * So the strength of this spec differs by platform, and it is worth being plain about: on iOS the app
 * is handed a file the OS calls a photo, so the CTA can only come from the app reading the bytes
 * itself. On Android the app is handed one the OS has already labelled a GIF, so the CTA may be
 * inherited from the picker rather than earned. The Android half still guards the outcome a user
 * cares about — a standard user cannot end up with an animated display picture — but only the iOS
 * half tests the app's own format detection.
 */
function pickerShowsItAsAnimated(platform: SupportedPlatformsType): boolean {
  return platform === 'android';
}

async function nonProFormatBypass(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, PRO_BACKEND_CONTEXT);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step(TestSteps.USER_ACTIONS.CHANGE_PROFILE_PICTURE, async () => {
    await device.uploadProfilePicture(
      pickerShowsItAsAnimated(platform),
      animatedProfilePictureAsPng
    );
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
    await device.uploadProfilePicture(
      pickerShowsItAsAnimated(platform),
      animatedProfilePictureAsPng
    );
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
