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

// First time Photos.app open triggers a "What's New" and a permissions modal
export async function handlePhotosFirstTimeOpen(device: DeviceWrapper) {
  const continueButton = await device.doesElementExist(new iOSPhotosContinuebutton(device));
  if (!continueButton) {
    device.log(`Photos app opened without a "What's New" screen, proceeding`);
  } else {
    device.log(`Photos app has been opened for the first time, dismissing modals`);
    await device.clickOnElementAll(new iOSPhotosContinuebutton(device));
    await device.clickOnByAccessibilityID('Don’t Allow');
  }
}
