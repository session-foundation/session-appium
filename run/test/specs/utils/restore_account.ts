import { sleepFor } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';

export const restoreAccount = async (device: DeviceWrapper, user: User) => {
  await device.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Restore your session button',
  });
  await device.inputText(user.recoveryPhrase, {
    strategy: 'accessibility id',
    selector: device.isAndroid() ? 'Recovery phrase input' : 'Recovery password input',
  });
  // Wait for continue button to become active
  await sleepFor(500);
  // Continue with recovery phrase
  await device.clickOnByAccessibilityID('Continue');
  // Wait for any notifications to disappear
  await device.clickOnByAccessibilityID('Slow mode notifications button');
  // Click continue on message notification settings
  await device.clickOnByAccessibilityID('Continue');
  // Wait for loading animation to look for display name
  await device.waitForLoadingOnboarding();
  const displayName = await device.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Enter display name',
    maxWait: 1000,
  });
  if (displayName) {
    await device.inputText(user.userName, {
      strategy: 'accessibility id',
      selector: 'Enter display name',
    });
    await device.clickOnByAccessibilityID('Continue');
  } else {
    console.info('Display name found: Loading account');
  }
  // Wait for permissions modal to pop up
  await sleepFor(500);
  await device.checkPermissions('Allow');
  await sleepFor(1000);
  await device.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Continue',
  });
  // Check that button was clicked
  await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'New conversation button',
  });
};
