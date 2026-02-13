import { TestInfo } from '@playwright/test';
import {
  W3CXCUITestDriverCaps,
  XCUITestDriver,
  XCUITestDriverOpts,
} from 'appium-xcuitest-driver/build/lib/driver';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { AllowPermissionLocator, DenyPermissionLocator } from '../locators/global';
import { BackgroundPermsAllowButton, BackgroundPermsCancelButton } from '../locators/home';
import { runScriptAndLog } from './utilities';

export const cleanPermissions = async (
  opts: XCUITestDriverOpts,
  udid: string,
  capabilities: W3CXCUITestDriverCaps,
  testInfo: TestInfo
) => {
  let wrappedDevice: DeviceWrapper | null = null;
  const maxRetries = 3;
  let retries = 0;

  do {
    try {
      const device: XCUITestDriver = new XCUITestDriver(opts);
      wrappedDevice = new DeviceWrapper(device, udid, testInfo);

      await wrappedDevice.createSession(capabilities);
      // This function closes any pop up that hasn't been dismissed from a previous test (only happens for iOS currently)
      await wrappedDevice.modalPopup({
        strategy: 'xpath',
        selector: `//XCUIElementTypeAlert//*//XCUIElementTypeButton`,
        maxWait: 500,
      });
      // This is to check if the app is already open, sometimes when dismissing the modal, the app closes
      await runScriptAndLog(
        `xcrun simctl privacy ${udid} reset all ${capabilities.alwaysMatch['appium:bundleId']}`,
        true
      );

      // Check if the "Create account button" is present (this is just to check if app is open)
      const createAccountButtonExists = await wrappedDevice.doesElementExist({
        strategy: 'accessibility id',
        selector: 'Create account button',
        maxWait: 5000,
      });

      if (createAccountButtonExists) {
        return { device: wrappedDevice };
      }
      console.info('Create account button not found. Retrying...');
      retries++;
      await wrappedDevice.deleteSession(); // Close the session before retrying
    } catch (error) {
      console.info('Error opening iOS app:', error);
      retries++;
      if (wrappedDevice) {
        await wrappedDevice.deleteSession(); // Close the session in case of an error
      }
    }
  } while (retries < maxRetries);

  throw new Error(
    'Failed to open the iOS app and find the Create account button after multiple retries.'
  );
};
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
