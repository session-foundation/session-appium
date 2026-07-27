import type { DeviceWrapper } from '../../types/DeviceWrapper';

import { AllowPermissionLocator, DenyPermissionLocator } from '../locators/global';
import { BackgroundPermsAllowButton, BackgroundPermsCancelButton } from '../locators/home';

export const handleNotificationPermissions = async (
  device: DeviceWrapper,
  allowNotificationPermissions: boolean = false
) => {
  const notificationPermsLocator = allowNotificationPermissions
    ? new AllowPermissionLocator(device)
    : new DenyPermissionLocator(device);

  await device.processPermissions(notificationPermsLocator);
};

/**
 * Handles the background permissions modal that appears in slow mode on Android.
 *
 * @param allowBackgroundPermissions
 *   - `undefined`: Modal is not handled - test must interact with it manually
 *   - `true`: Auto-allow background permissions
 *   - `false`: Auto-deny background permissions
 */
export const handleBackgroundPermissions = async (
  device: DeviceWrapper,
  allowBackgroundPermissions?: boolean
) => {
  if (allowBackgroundPermissions == undefined) return;

  if (allowBackgroundPermissions) {
    await device.clickOnElementAll(new BackgroundPermsAllowButton(device));
    await device.clickOnElementAll({
      strategy: 'id',
      selector: 'android:id/button1',
      text: 'Allow',
    });
  } else {
    await device.clickOnElementAll(new BackgroundPermsCancelButton(device));
  }
};
