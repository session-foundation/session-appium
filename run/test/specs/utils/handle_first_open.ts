import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { ChromeNotificationsNegativeButton, ChromeUseWithoutAnAccount } from '../locators/browsers';
import { iOSPhotosContinuebutton } from '../locators/external';

// First time open of Chrome triggers an account check and a notifications modal
export async function handleChromeFirstTimeOpen(device: DeviceWrapper) {
  const chromeUseWithoutAnAccount = await device.doesElementExist(
    new ChromeUseWithoutAnAccount(device)
  );
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
    const continueButton = await device.doesElementExist(new iOSPhotosContinuebutton(device));
    if (!continueButton) {
      device.log(`Photos app opened without a "What's New" screen, proceeding`);
    } else {
      device.log(`Photos app has been opened for the first time, dismissing modals`);
      await device.clickOnElementAll(new iOSPhotosContinuebutton(device));
      await device.clickOnByAccessibilityID('Don’t Allow');
  }
  // On Android, the Photos app shows a sign-in prompt the first time it's opened that needs to be dismissed
  if (device.isAndroid()) {
    const signInButton = await device.doesElementExist({
      strategy: 'id',
      selector: 'com.google.android.apps.photos:id/sign_in_button'
    });
    if (!signInButton) {
      device.log(`Photos app opened without a sign-in prompt, proceeding`);
    } else {
      device.log(`Photos app has been opened for the first time, dismissing sign-in prompt`);
      await device.clickOnCoordinates(550, 500); // Tap outside of the sign-in modal to dismiss
    }
  }
}
}
