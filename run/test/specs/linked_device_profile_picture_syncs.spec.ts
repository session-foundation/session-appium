import { bothPlatformsIt } from '../../types/sessionIt';
import { UserSettings } from './locators/settings';
import { open_Alice2 } from './state_builder';
import { runOnlyOnAndroid, sleepFor } from './utils';
import { parseDataImage } from './utils/check_colour';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Avatar restored',
  risk: 'medium',
  testCb: avatarRestored,
  countOfDevicesNeeded: 2,
});

async function avatarRestored(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform, testInfo });

  let expectedPixelHexColour: string;
  if (platform === 'android') {
    expectedPixelHexColour = 'cbfeff';
  } else if (platform === 'ios') {
    expectedPixelHexColour = '04cbfe';
  } else {
    throw new Error('Platform not supported');
  }
  await alice1.uploadProfilePicture();
  await sleepFor(5000);
  // Wait for change
  // Verify change
  // Take screenshot
  await alice2.clickOnElementAll(new UserSettings(alice2));
  await alice1.onIOS().waitForLoadingOnboarding();
  await runOnlyOnAndroid(platform, () => sleepFor(10000)); // we can't avoid this runOnlyOnAndroid
  // Need to find locator right before screenshot otherwise locator expires
  const profilePicture = await alice1.waitForTextElementToBePresent(new UserSettings(alice1));
  const base64 = await alice1.getElementScreenshot(profilePicture.ELEMENT);
  const actualPixelColor = await parseDataImage(base64);
  if (actualPixelColor === expectedPixelHexColour) {
    console.log('alice1: Colour is correct');
  } else {
    throw new Error(`alice1: Colour isn't ${expectedPixelHexColour}, it is: ` + actualPixelColor);
  }
  console.log('Now checking avatar on linked device');
  // Check avatar on device 2
  await sleepFor(5000);
  await alice2.closeScreen();
  await alice2.clickOnElementAll(new UserSettings(alice2));
  const profilePictureLinked = await alice2.waitForTextElementToBePresent(new UserSettings(alice2));
  const base64A = await alice2.getElementScreenshot(profilePictureLinked.ELEMENT);
  const actualPixelColorLinked = await parseDataImage(base64A);
  if (actualPixelColorLinked !== expectedPixelHexColour) {
    throw new Error(
      `alice1: Colour isn't ${expectedPixelHexColour}, it is: ` + actualPixelColorLinked
    );
  }
  console.log('Device 2: Colour is correct on linked device');

  await closeApp(alice1, alice2);
}
