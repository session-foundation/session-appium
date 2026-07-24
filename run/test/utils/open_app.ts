import type { TestInfo } from '@playwright/test';

import AndroidUiautomator2Driver from 'appium-uiautomator2-driver';
import {
  W3CXCUITestDriverCaps,
  XCUITestDriver,
  XCUITestDriverOpts,
} from 'appium-xcuitest-driver/build/lib/driver';
import { DriverOpts } from 'appium/build/lib/appium';
import { compact } from 'lodash';

import { recoverEmulator } from '../../../scripts/emulator_health';
import { sleepFor } from '../../shared/promise_utils';
import { AndroidDeviceWrapper } from '../../types/AndroidDeviceWrapper';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { IosDeviceWrapper } from '../../types/IosDeviceWrapper';
import { getAdbFullPath, getDevicesPerTestCount } from './binaries';
import { androidAppPackage, getAndroidCapabilities, getAndroidUdid } from './capabilities_android';
import {
  CapabilitiesIndexType,
  capabilityIsValid,
  getIosCapabilities,
  iOSBundleId,
  IOSTestContext,
} from './capabilities_ios';
import { registerDevicesForTest } from './device_registry';
import { runScriptAndLog } from './utilities';

const APPIUM_PORT = 4728;

export type SupportedPlatformsType = 'android' | 'ios';

export const openAppMultipleDevices = async (
  platform: SupportedPlatformsType,
  numberOfDevices: number,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<DeviceWrapper[]> => {
  // Create an array of promises for each device
  const devicePromises = Array.from({ length: numberOfDevices }, (_, index) =>
    openAppOnPlatform(platform, index as CapabilitiesIndexType, testInfo, iOSContext)
  );

  // Use Promise.all to wait for all device apps to open
  const apps = await Promise.all(devicePromises);

  //  Map the result to return only the device objects
  const devices = apps.map(app => app.device);

  await registerDevicesForTest(testInfo, devices);

  return devices;
};

const openAppOnPlatform = async (
  platform: SupportedPlatformsType,
  capabilitiesIndex: CapabilitiesIndexType,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<{
  device: DeviceWrapper;
}> => {
  console.info('starting capabilitiesIndex', capabilitiesIndex, platform);
  return platform === 'ios'
    ? openiOSApp(capabilitiesIndex, testInfo, iOSContext)
    : openAndroidApp(capabilitiesIndex, testInfo);
};

export const openAppOnPlatformSingleDevice = async (
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<{
  device: DeviceWrapper;
}> => {
  const result = await openAppOnPlatform(platform, 0, testInfo, iOSContext);

  await registerDevicesForTest(testInfo, [result.device]);

  return result;
};

export const openAppTwoDevices = async (
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
}> => {
  const [app1, app2] = await Promise.all([
    openAppOnPlatform(platform, 0, testInfo, iOSContext),
    openAppOnPlatform(platform, 1, testInfo, iOSContext),
  ]);

  const result = { device1: app1.device, device2: app2.device };

  await registerDevicesForTest(testInfo, Object.values(result));

  return result;
};

export const openAppThreeDevices = async (
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
  device3: DeviceWrapper;
}> => {
  const [app1, app2, app3] = await Promise.all([
    openAppOnPlatform(platform, 0, testInfo, iOSContext),
    openAppOnPlatform(platform, 1, testInfo, iOSContext),
    openAppOnPlatform(platform, 2, testInfo, iOSContext),
  ]);

  const result = {
    device1: app1.device,
    device2: app2.device,
    device3: app3.device,
  };

  await registerDevicesForTest(testInfo, Object.values(result));

  return result;
};

export const openAppFourDevices = async (
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
  device3: DeviceWrapper;
  device4: DeviceWrapper;
}> => {
  const [app1, app2, app3, app4] = await Promise.all([
    openAppOnPlatform(platform, 0, testInfo, iOSContext),
    openAppOnPlatform(platform, 1, testInfo, iOSContext),
    openAppOnPlatform(platform, 2, testInfo, iOSContext),
    openAppOnPlatform(platform, 3, testInfo, iOSContext),
  ]);

  const result = {
    device1: app1.device,
    device2: app2.device,
    device3: app3.device,
    device4: app4.device,
  };

  await registerDevicesForTest(testInfo, Object.values(result));

  return result;
};

async function isEmulatorRunning(emulatorName: string) {
  const failedWith = await runScriptAndLog(
    `${getAdbFullPath()} -s ${emulatorName} get-state;`,
    false
  );

  return !failedWith || !(failedWith.includes('error') || failedWith.includes('offline'));
}

async function waitForEmulatorToBeRunning(emulatorName: string) {
  let start = Date.now();
  let found: boolean;

  do {
    found = await isEmulatorRunning(emulatorName);
    await sleepFor(500);
  } while (Date.now() - start < 50000 && !found);

  if (!found) {
    console.warn('isEmulatorRunning failed for 25s');
    throw new Error('timedout waiting for emulator to start');
  }

  start = Date.now();

  do {
    const bootedOrNah = await runScriptAndLog(
      `${getAdbFullPath()} -s  "${emulatorName}" shell getprop sys.boot_completed;`
    );

    found = bootedOrNah.includes('1');

    await sleepFor(500);
  } while (Date.now() - start < 25000 && !found);

  return found;
}

const openAndroidApp = async (
  capabilitiesIndex: CapabilitiesIndexType,
  testInfo: TestInfo
): Promise<{
  device: DeviceWrapper;
}> => {
  const parallelIndex = process.env.TEST_PARALLEL_INDEX || '1';
  console.info('process.env.TEST_PARALLEL_INDEX:', process.env.TEST_PARALLEL_INDEX, parallelIndex);
  const parallelIndexNumber = parseInt(parallelIndex);
  const actualCapabilitiesIndex =
    capabilitiesIndex + getDevicesPerTestCount() * parallelIndexNumber;

  if (!capabilityIsValid(actualCapabilitiesIndex)) {
    throw new Error(`Invalid actual capability given: ${actualCapabilitiesIndex}`);
  }

  if (isNaN(actualCapabilitiesIndex)) {
    console.info('actualCapabilities worker is not a number', actualCapabilitiesIndex);
  } else {
    console.info('actualCapabilities worker', actualCapabilitiesIndex);
  }
  const targetName = getAndroidUdid(actualCapabilitiesIndex);

  const emulatorAlreadyRunning = await isEmulatorRunning(targetName);
  console.info('emulatorAlreadyRunning', targetName, emulatorAlreadyRunning);
  if (!emulatorAlreadyRunning) {
    if (process.env.CI === '1') {
      // Emulator died mid-job — attempt recovery before failing the test.
      // Each worker owns a fixed port range (determined by TEST_PARALLEL_INDEX), so
      // parallel workers will never race to recover the same emulator.
      const port = parseInt(targetName.replace('emulator-', ''));
      await recoverEmulator((port - 5554) / 2 + 1);
    } else {
      throw new Error(`Emulator "${targetName}" is not running. Please start it manually.`);
    }
  }
  await waitForEmulatorToBeRunning(targetName);
  console.log(targetName, ' emulator booted');

  const capabilities = getAndroidCapabilities(actualCapabilitiesIndex);
  console.log(
    `Android App Full Path: ${
      getAndroidCapabilities(actualCapabilitiesIndex)['alwaysMatch']['appium:app'] as any
    }`
  );
  console.info('capabilities', capabilities);

  const opts: DriverOpts = {
    address: `http://localhost:${APPIUM_PORT}`,
  } as DriverOpts;

  const device = new AndroidUiautomator2Driver(opts);
  const udid = getAndroidUdid(actualCapabilitiesIndex);
  console.log(`udid: ${udid}`);
  const wrappedDevice = new AndroidDeviceWrapper(device, udid, testInfo);

  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global heads_up_notifications_enabled 0
    `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global window_animation_scale 0
    `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global transition_animation_scale 0
    `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global animator_duration_scale 0
    `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global show_first_crash_dialog 0
  `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put secure anr_show_background 0
`);

  await wrappedDevice.createSession(capabilities);

  await (device as any).updateSettings({
    ignoreUnimportantViews: false,
    allowInvisibleElements: true,
    enableMultiWindows: true,
    disableIdLocatorAutocompletion: true,
  });
  return { device: wrappedDevice };
};

// Opens the iOS app, dismissing any leftover modal and resetting privacy, retrying a few times.
// Lives here (rather than in permissions.ts) so that constructing the IosDeviceWrapper subclass
// doesn't pull a DeviceWrapper subclass into DeviceWrapper's own module-init chain.
const cleanPermissions = async (
  opts: XCUITestDriverOpts,
  udid: string,
  capabilities: W3CXCUITestDriverCaps,
  testInfo: TestInfo
): Promise<{ device: DeviceWrapper }> => {
  let wrappedDevice: DeviceWrapper | null = null;
  const maxRetries = 3;
  let retries = 0;

  do {
    try {
      const device: XCUITestDriver = new XCUITestDriver(opts);
      wrappedDevice = new IosDeviceWrapper(device, udid, testInfo);

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
      await wrappedDevice.deleteSession().catch(() => {}); // Close the session before retrying; ignore cleanup failures
    } catch (error) {
      console.info('Error opening iOS app:', error);
      retries++;
      if (wrappedDevice) {
        await wrappedDevice.deleteSession().catch(() => {}); // Close the session in case of an error; ignore cleanup failures (e.g. session never created)
      }
    }
  } while (retries < maxRetries);

  throw new Error(
    'Failed to open the iOS app and find the Create account button after multiple retries.'
  );
};

const openiOSApp = async (
  capabilitiesIndex: CapabilitiesIndexType,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<{
  device: DeviceWrapper;
}> => {
  console.info('openiOSApp');
  const parallelIndex = parseInt(process.env.TEST_PARALLEL_INDEX || '0');

  // Each Playwright worker owns a fixed pool of `DEVICES_PER_TEST_COUNT` simulators, offset by
  // the worker's parallel index, so multiple workers never target the same simulator. This runs
  // locally as well as on CI: with a single worker (parallelIndex 0) it collapses to devices
  // 0..N-1, and with more workers it fans out (worker 0: devices 0-3, worker 1: 4-7, ...).
  // To run >1 worker locally you must provision `workers * DEVICES_PER_TEST_COUNT` simulators —
  // `pnpm test-ios-parallel` does this for you.
  const devicesPerWorker = getDevicesPerTestCount();

  // Guard: a test can only run if its device count fits within a single worker's pool. Without
  // this, `capabilitiesIndex % devicesPerWorker` below would silently wrap and map two logical
  // devices (e.g. alice and charlie) onto the SAME simulator, corrupting the test. Fail loudly
  // with actionable guidance instead. (Never triggers on CI, where the pool of 4 covers the
  // largest test.)
  if (capabilitiesIndex >= devicesPerWorker) {
    throw new Error(
      `This test needs at least ${capabilitiesIndex + 1} devices, but each worker is allocated ` +
        `only ${devicesPerWorker} simulator(s) (DEVICES_PER_TEST_COUNT=${devicesPerWorker}). ` +
        `Re-run with a larger pool, e.g. \`pnpm test-ios-parallel --devices ${capabilitiesIndex + 1}\`, ` +
        `or filter to tests that fit, e.g. \`--grep '@ios @${devicesPerWorker}-devices'\`.`
    );
  }

  const workerBaseOffset = devicesPerWorker * parallelIndex;

  // Apply retry offset, but wrap within the worker's device pool only.
  // This means when retrying, alice/bob etc won't be the same device as before within a worker's
  // pool, to avoid any issues where a device might be in a bad state for some reason
  // (e.g. not accessing photo library on iOS).
  const retryOffset = testInfo.retry || 0;
  const deviceIndexWithinWorker = (capabilitiesIndex + retryOffset) % devicesPerWorker;
  const actualCapabilitiesIndex = workerBaseOffset + deviceIndexWithinWorker;

  if (retryOffset > 0) {
    console.info(
      `Retry offset applied (#${retryOffset}), rotating device allocations within worker`
    );
  }

  const opts: XCUITestDriverOpts = {
    address: `http://localhost:${APPIUM_PORT}`,
  } as XCUITestDriverOpts;

  const capabilities = getIosCapabilities(
    actualCapabilitiesIndex as CapabilitiesIndexType,
    iOSContext
  );
  const udid = capabilities.alwaysMatch['appium:udid'] as string;

  const { device: wrappedDevice } = await cleanPermissions(opts, udid, capabilities, testInfo);
  return { device: wrappedDevice };
};

export const closeApp = async (...devices: Array<DeviceWrapper>) => {
  await Promise.all(compact(devices).map(d => d.deleteSession()));

  console.info('sessions closed');
};

export const uninstallApp = async (device: DeviceWrapper, platform: SupportedPlatformsType) => {
  const command =
    platform === 'android'
      ? `${getAdbFullPath()} -s ${device.udid} uninstall ${androidAppPackage}`
      : `xcrun simctl uninstall ${device.udid} ${iOSBundleId}`;

  await runScriptAndLog(command, true);
};
