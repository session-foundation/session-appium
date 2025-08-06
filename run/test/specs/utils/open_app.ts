import type { TestInfo } from '@playwright/test';

import AndroidUiautomator2Driver from 'appium-uiautomator2-driver';
import { XCUITestDriverOpts } from 'appium-xcuitest-driver/build/lib/driver';
import { DriverOpts } from 'appium/build/lib/appium';
import { compact } from 'lodash';

import { DeviceWrapper } from '../../../types/DeviceWrapper';
import {
  getAdbFullPath,
  getAndroidSystemImageToUse,
  getDevicesPerTestCount,
  getEmulatorFullPath,
  getSdkManagerFullPath,
} from './binaries';
import { getAndroidCapabilities, getAndroidUdid } from './capabilities_android';
import { CapabilitiesIndexType, capabilityIsValid, getIosCapabilities } from './capabilities_ios';
import { cleanPermissions } from './permissions';
import { registerDevicesForTest } from './screenshot_helper';
import { sleepFor } from './sleep_for';
import { isCI, runScriptAndLog } from './utilities';

const APPIUM_PORT = 4728;

export type SupportedPlatformsType = 'android' | 'ios';

/* ******************Command to run Appium Server: *************************************
./node_modules/.bin/appium server --use-drivers=uiautomator2,xcuitest --port 8110 --use-plugins=execute-driver --allow-cors
*/

export const openAppMultipleDevices = async (
  platform: SupportedPlatformsType,
  numberOfDevices: number,
  testInfo: TestInfo
): Promise<DeviceWrapper[]> => {
  // Create an array of promises for each device
  const devicePromises = Array.from({ length: numberOfDevices }, (_, index) =>
    openAppOnPlatform(platform, index as CapabilitiesIndexType)
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
  capabilitiesIndex: CapabilitiesIndexType
): Promise<{
  device: DeviceWrapper;
}> => {
  console.info('starting capabilitiesIndex', capabilitiesIndex, platform);
  return platform === 'ios' ? openiOSApp(capabilitiesIndex) : openAndroidApp(capabilitiesIndex);
};

export const openAppOnPlatformSingleDevice = async (
  platform: SupportedPlatformsType,
  testInfo: TestInfo
): Promise<{
  device: DeviceWrapper;
}> => {
  const result = await openAppOnPlatform(platform, 0);

  registerDevicesForTest(testInfo, [result.device], platform);

  return result;
};

export const openAppTwoDevices = async (
  platform: SupportedPlatformsType,
  testInfo: TestInfo
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
}> => {
  const [app1, app2] = await Promise.all([
    openAppOnPlatform(platform, 0),
    openAppOnPlatform(platform, 1),
  ]);

  const result = { device1: app1.device, device2: app2.device };

  registerDevicesForTest(testInfo, Object.values(result), platform);

  return result;
};

export const openAppThreeDevices = async (
  platform: SupportedPlatformsType,
  testInfo: TestInfo
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
  device3: DeviceWrapper;
}> => {
  const [app1, app2, app3] = await Promise.all([
    openAppOnPlatform(platform, 0),
    openAppOnPlatform(platform, 1),
    openAppOnPlatform(platform, 2),
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
  testInfo: TestInfo
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
  device3: DeviceWrapper;
  device4: DeviceWrapper;
}> => {
  const [app1, app2, app3, app4] = await Promise.all([
    openAppOnPlatform(platform, 0),
    openAppOnPlatform(platform, 1),
    openAppOnPlatform(platform, 2),
    openAppOnPlatform(platform, 3),
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
  let found = false;

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
  capabilitiesIndex: CapabilitiesIndexType
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
  const targetName = getAndroidUdid(actualCapabilitiesIndex as CapabilitiesIndexType);

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

  const capabilities = getAndroidCapabilities(actualCapabilitiesIndex as CapabilitiesIndexType);
  console.log(
    `Android App Full Path: ${
      getAndroidCapabilities(actualCapabilitiesIndex as CapabilitiesIndexType)['alwaysMatch'][
        'appium:app'
      ] as any
    }`
  );
  console.info('capabilities', capabilities);

  const opts: DriverOpts = {
    address: `http://localhost:${APPIUM_PORT}`,
  } as DriverOpts;

  const device = new AndroidUiautomator2Driver(opts);
  const udid = getAndroidUdid(actualCapabilitiesIndex as CapabilitiesIndexType);
  console.log(`udid: ${udid}`);
  const wrappedDevice = new DeviceWrapper(device, udid);

  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global heads_up_notifications_enabled 0
    `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global window_animation_scale 0
    `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global transition_animation_scale 0
    `);
  await runScriptAndLog(`${getAdbFullPath()} -s ${targetName} shell settings put global animator_duration_scale 0
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
  capabilitiesIndex: CapabilitiesIndexType
): Promise<{
  device: DeviceWrapper;
}> => {
  console.info('openiOSApp');

  let actualCapabilitiesIndex: CapabilitiesIndexType;

  // Check if Playwright allocated specific devices
  if (process.env.ALLOCATED_DEVICES) {
    try {
      console.log(`🔍 [DEBUG] Raw ALLOCATED_DEVICES from env: "${process.env.ALLOCATED_DEVICES}"`);
      const allocatedDevicesStr = process.env.ALLOCATED_DEVICES || '';
      let allocatedDevices: number[] = [];

      if (allocatedDevicesStr) {
        // Handle both comma-separated and single values
        if (allocatedDevicesStr.includes(',')) {
          // Multiple devices: "0,1,2"
          allocatedDevices = allocatedDevicesStr.split(',').map(Number);
        } else if (allocatedDevicesStr.trim() !== '') {
          // Single device: "1" -> [1]
          allocatedDevices = [Number(allocatedDevicesStr)];
        }
      }

      // Debug log to verify parsing
      console.log(
        `📋 [DEVICE_ALLOCATION] Parsed devices: [${allocatedDevices.join(',')}] from env value: "${allocatedDevicesStr}"`
      );

      // Validate that we have enough allocated devices
      if (!Array.isArray(allocatedDevices)) {
        throw new Error('ALLOCATED_DEVICES must be an array');
      }

      if (capabilitiesIndex >= allocatedDevices.length) {
        throw new Error(
          `Test requested device index ${capabilitiesIndex} but only ${allocatedDevices.length} devices were allocated. ` +
            `Allocated devices: [${allocatedDevices.join(', ')}]`
        );
      }

      // capabilitiesIndex is the nth device this test wants (0, 1, etc)
      // map it to the actual device index allocated by Playwright
      actualCapabilitiesIndex = allocatedDevices[capabilitiesIndex] as CapabilitiesIndexType;

      console.info(
        `✅ [DEVICE_ALLOCATION] Using Playwright-allocated device ${actualCapabilitiesIndex} for test device ${capabilitiesIndex}`,
        `(Allocated devices: [${allocatedDevices.join(', ')}])`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [DEVICE_ALLOCATION] Failed to parse ALLOCATED_DEVICES:', error);
      throw new Error(
        `Failed to parse ALLOCATED_DEVICES environment variable: ${errorMessage}. ` +
          `Value was: ${process.env.ALLOCATED_DEVICES}`
      );
    }
  } else {
    // Fallback to old calculation for backward compatibility
    const parallelIndex = parseInt(process.env.TEST_PARALLEL_INDEX || '0');
    actualCapabilitiesIndex = (capabilitiesIndex +
      getDevicesPerTestCount() * parallelIndex) as CapabilitiesIndexType;

    console.warn(
      `⚠️  [DEVICE_ALLOCATION] Using legacy device calculation. ` +
        `Device ${capabilitiesIndex} -> ${actualCapabilitiesIndex} (parallel index: ${parallelIndex})`
    );
  }

  const opts: XCUITestDriverOpts = {
    address: `http://localhost:${APPIUM_PORT}`,
  } as XCUITestDriverOpts;

  const capabilities = getIosCapabilities(actualCapabilitiesIndex);
  const udid = capabilities.alwaysMatch['appium:udid'] as string;

  console.info(`📱 [iOS] Opening app on device ${actualCapabilitiesIndex} (UDID: ${udid})`);

  const { device: wrappedDevice } = await cleanPermissions(opts, udid, capabilities);
  return { device: wrappedDevice };
};
export const closeApp = async (...devices: Array<DeviceWrapper>) => {
  await Promise.all(compact(devices).map(d => d.deleteSession()));

  console.info('sessions closed');
};
