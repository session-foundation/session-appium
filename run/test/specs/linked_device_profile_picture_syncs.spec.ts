import { bothPlatformsIt } from '../../types/sessionIt';
import { UserSettings } from './locators/settings';
import { open2AppsLinkedUser } from './state_builder';
import { runOnlyOnAndroid, sleepFor } from './utils';
import { parseDataImage } from './utils/check_colour';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Avatar restored',
  risk: 'medium',
  testCb: avatarRestored,
  countOfDevicesNeeded: 2,
});

async function avatarRestored(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsLinkedUser({ platform });
  
  let expectedPixelHexColour: string;
  if (platform === 'android') {
    expectedPixelHexColour = 'cbfeff';
  } else if (platform === 'ios') {
    expectedPixelHexColour = '04cbfe';
  } else {
    throw new Error('Platform not supported');
  }
  await device1.uploadProfilePicture();
  await sleepFor(5000);
  // Wait for change
  // Verify change
  // Take screenshot
  await device2.clickOnElementAll(new UserSettings(device2));
  await device1.onIOS().waitForLoadingOnboarding();
  await runOnlyOnAndroid(platform, () => sleepFor(10000)); // we can't avoid this runOnlyOnAndroid
  // Need to find locator right before screenshot otherwise locator expires
  const profilePicture = await device1.waitForTextElementToBePresent(new UserSettings(device1));
  const base64 = await device1.getElementScreenshot(profilePicture.ELEMENT);
  const actualPixelColor = await parseDataImage(base64);
  if (actualPixelColor === expectedPixelHexColour) {
    console.log('Device1: Colour is correct');
  } else {
    throw new Error(`Device1: Colour isn't ${expectedPixelHexColour}, it is: ` + actualPixelColor);
  }
  console.log('Now checking avatar on linked device');
  // Check avatar on device 2
  await sleepFor(5000);
  await device2.closeScreen();
  await device2.clickOnElementAll(new UserSettings(device2));
  const profilePictureLinked = await device2.waitForTextElementToBePresent(
    new UserSettings(device2)
  );
  const base64A = await device2.getElementScreenshot(profilePictureLinked.ELEMENT);
  const actualPixelColorLinked = await parseDataImage(base64A);
  if (actualPixelColorLinked !== expectedPixelHexColour) {
    throw new Error(
      `Device1: Colour isn't ${expectedPixelHexColour}, it is: ` + actualPixelColorLinked
    );
  }
  console.log('Device 2: Colour is correct on linked device');

  await closeApp(device1, device2);
}
