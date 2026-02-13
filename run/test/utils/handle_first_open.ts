import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ChromeNotificationsNegativeButton, ChromeUseWithoutAnAccount } from '../locators/browsers';
import { iOSPhotosContinuebutton } from '../locators/external';

// First time open of Chrome triggers an account check and a notifications modal
export async function handleChromeFirstTimeOpen(device: DeviceWrapper) {
  const chromeUseWithoutAnAccount = await device.doesElementExist({
    ...new ChromeUseWithoutAnAccount(device).build(),
    maxWait: 2_000,
  });
  if (!chromeUseWithoutAnAccount) {
    device.log('Chrome opened without an account check, proceeding');
  } else {
    device.log(
      'Chrome has been opened for the first time, dismissing account use and notifications'
    );
    await device.clickOnElementAll(new ChromeUseWithoutAnAccount(device));
    await device.clickOnElementAll(new ChromeNotificationsNegativeButton(device));
  }
}

export async function handlePhotosFirstTimeOpen(device: DeviceWrapper) {
  // On iOS there's a "What's New" screen that appears the first time Photos app is opened
  if (device.isIOS()) {
    const continueButton = await device.doesElementExist({
      ...new iOSPhotosContinuebutton(device).build(),
      maxWait: 5_000,
    });
    if (!continueButton) {
      device.log(`Photos app opened without a "What's New" screen, proceeding`);
    } else {
      device.log(`Photos app has been opened for the first time, dismissing modals`);
      await device.clickOnElementAll(new iOSPhotosContinuebutton(device));
      await device.clickOnByAccessibilityID('Don’t Allow');
    }
  }
  // On Android, the Photos app shows a sign-in prompt the first time it's opened that needs to be dismissed
  // I've seen two different kinds of sign in buttons on the same set of emulators
  if (device.isAndroid()) {
    let signInButton = null;
    signInButton = await device.doesElementExist({
      strategy: 'id',
      selector: 'com.google.android.apps.photos:id/sign_in_button',
      maxWait: 1_000,
    });

    if (!signInButton) {
      signInButton = await device.doesElementExist({
        strategy: '-android uiautomator',
        selector: 'new UiSelector().text("Sign in")',
        maxWait: 1_000,
      });
    }
    if (!signInButton) {
      device.log(`Photos app opened without a sign-in prompt, proceeding`);
    } else {
      device.log(`Photos app has been opened for the first time, dismissing sign-in prompt`);
      await device.clickOnCoordinates(550, 500); // Tap outside of the sign-in modal to dismiss
    }
  }
}
