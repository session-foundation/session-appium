import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { parseDataImage } from './utils/check_colour';
import { newUser } from './utils/create_account';
import { SupportedPlatformsType, closeApp, openAppOnPlatformSingleDevice } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Change profile picture',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  ios: {
    testCb: changeProfilePictureiOS,
  },
  android: {
    testCb: changeProfilePictureAndroid,
  },
});

async function changeProfilePictureiOS(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  const pixelHexColour = '04cbfe';
  // Create new user
  await newUser(device, USERNAME.ALICE);
  // Click on settings/avatar
  await device.uploadProfilePicture();
  // Take screenshot
  await sleepFor(4000);
  const el = await device.waitForTextElementToBePresent(new UserSettings(device));
  const base64 = await device.getElementScreenshot(el.ELEMENT);
  const pixelColor = await parseDataImage(base64);
  console.log('RGB Value of pixel is:', pixelColor);
  if (pixelColor === pixelHexColour) {
    console.log('Colour is correct');
  } else {
    console.log("Colour isn't 04cbfe, it is: ", pixelColor);
  }
  await closeApp(device);
}

async function changeProfilePictureAndroid(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  let expectedPixelHexColour: string;
  if (platform === 'android') {
    expectedPixelHexColour = 'cbfeff';
  } else if (platform === 'ios') {
    expectedPixelHexColour = '04cbfe';
  } else {
    throw new Error('Platform not supported');
  }
  // Create new user
  await newUser(device, USERNAME.ALICE);
  // Click on settings/avatar
  await device.uploadProfilePicture();
  const el = await device.waitForTextElementToBePresent(new UserSettings(device));
  // Waiting for the image to change in the UI
  await sleepFor(10000);
  const base64 = await device.getElementScreenshot(el.ELEMENT);
  const actualPixelColor = await parseDataImage(base64);
  console.log('Hex value of pixel is:', actualPixelColor);
  if (actualPixelColor === expectedPixelHexColour) {
    console.log('Colour is correct');
  } else {
    throw new Error(`Colour isn't ${expectedPixelHexColour}, it is: ` + actualPixelColor);
  }
  await closeApp(device);
}
