import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { ChromeNotificationsNegativeButton, ChromeUseWithoutAnAccount } from '../locators/browsers';

// First time open of Chrome triggers an account check and a notifications modal
export async function isChromeFirstTimeOpen(device: DeviceWrapper) {
  const chromeUseWithoutAnAccount = await device.doesElementExist(
    new ChromeUseWithoutAnAccount(device)
  );
  if (!chromeUseWithoutAnAccount) {
    console.log('Chrome opened without an account check, proceeding');
  } else {
    console.log(
      'Chrome has been opened for the first time, dismissing account use and notifications'
    );
    await device.clickOnElementAll(new ChromeUseWithoutAnAccount(device));
    await device.clickOnElementAll(new ChromeNotificationsNegativeButton(device));
  }
}
