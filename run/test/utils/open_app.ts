import type { TestInfo } from '@playwright/test';

import AndroidUiautomator2Driver from 'appium-uiautomator2-driver';
import { XCUITestDriverOpts } from 'appium-xcuitest-driver/build/lib/driver';
import { DriverOpts } from 'appium/build/lib/appium';
import { compact } from 'lodash';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import {
  getAdbFullPath,
  getAndroidSystemImageToUse,
  getDevicesPerTestCount,
  getEmulatorFullPath,
  getSdkManagerFullPath,
} from './binaries';
import { androidAppPackage, getAndroidCapabilities, getAndroidUdid } from './capabilities_android';
import {
  CapabilitiesIndexType,
  capabilityIsValid,
  getIosCapabilities,
  iOSBundleId,
  IOSTestContext,
} from './capabilities_ios';
import { cleanPermissions } from './permissions';
import { registerDevicesForTest } from './screenshot_helper';
import { sleepFor } from './sleep_for';
import { isCI, runScriptAndLog } from './utilities';

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

  registerDevicesForTest(testInfo, devices, platform);

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

  registerDevicesForTest(testInfo, [result.device], platform);

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

  registerDevicesForTest(testInfo, Object.values(result), platform);

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

  registerDevicesForTest(testInfo, Object.values(result), platform);

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

  registerDevicesForTest(testInfo, Object.values(result), platform);

  return result;
};

async function createAndroidEmulator(emulatorName: string) {
  if (isCI()) {
    // on CI, emulators are created during the docker build step.
    return emulatorName;
  }
  const installSystemImageCmd = `${getSdkManagerFullPath()} --install '${getAndroidSystemImageToUse()}'`;
  console.warn(installSystemImageCmd);
  await runScriptAndLog(installSystemImageCmd);

  const createCmd = `echo "no" | ${getSdkManagerFullPath()} create avd --name ${emulatorName} -k '${getAndroidSystemImageToUse()}' --force --skin pixel_5`;
  console.info(createCmd);
  await runScriptAndLog(createCmd);
  return emulatorName;
}

async function startAndroidEmulator(emulatorName: string) {
  await runScriptAndLog(`echo "hw.lcd.density=440" >> ~/.android/avd/${emulatorName}.avd/config.ini
  `);
  const startEmulatorCmd = `${getEmulatorFullPath()} @${emulatorName}`;
  console.info(`${startEmulatorCmd} & ; disown`);
  await runScriptAndLog(
    startEmulatorCmd // -netdelay none -no-snapshot -wipe-data
  );
}

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
    if (process.env.CI) {
      throw new Error(
        `Emulator "${targetName}" is not running but it should have been started earlier.`
      );
    }
    await createAndroidEmulator(targetName);
    void startAndroidEmulator(targetName);
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
  const wrappedDevice = new DeviceWrapper(device, udid, testInfo);

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

const openiOSApp = async (
  capabilitiesIndex: CapabilitiesIndexType,
  testInfo: TestInfo,
  iOSContext?: IOSTestContext
): Promise<{
  device: DeviceWrapper;
}> => {
  console.info('openiOSApp');
  let actualCapabilitiesIndex: number;
  const parallelIndex = parseInt(process.env.TEST_PARALLEL_INDEX || '0');
  if (process.env.CI === '1') {
    // NOTE: This assumes DEVICES_PER_TEST_COUNT=4 is set in CI for iOS (not applicable to Android)
    // Worker pools are fixed at 4 devices each regardless of actual test size:
    // Worker 0: devices 0-3, Worker 1: devices 4-7, Worker 2: devices 8-11
    const devicesPerWorker = getDevicesPerTestCount();
    const workerBaseOffset = devicesPerWorker * parallelIndex;

    // Apply retry offset, but wrap within the worker's device pool only
    // This means when retrying, alice/bob etc won't be the same device as before within a worker's pool
    // This is to avoid any issues where a device might be in a bad state for some reason
    // (e.g. not accessing photo library on iOS)
    const retryOffset = testInfo.retry || 0;
    const deviceIndexWithinWorker = (capabilitiesIndex + retryOffset) % devicesPerWorker;
    actualCapabilitiesIndex = workerBaseOffset + deviceIndexWithinWorker;

    if (retryOffset > 0) {
      console.info(
        `Retry offset applied (#${retryOffset}), rotating device allocations within worker`
      );
    }
  } else {
    actualCapabilitiesIndex = capabilitiesIndex;
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
