import { getAndroidCapabilities, getAndroidUdid } from './capabilities_android';
import { CapabilitiesIndexType, capabilityIsValid, getIosCapabilities } from './capabilities_ios';
import { isCI, runScriptAndLog } from './utilities';

import { XCUITestDriverOpts } from 'appium-xcuitest-driver/build/lib/driver';
import AndroidUiautomator2Driver from 'appium-uiautomator2-driver';

import { DriverOpts } from 'appium/build/lib/appium';
import { compact } from 'lodash';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User, USERNAME } from '../../../types/testing';
import { cleanPermissions } from './permissions';
import { newUser } from './create_account';
import { newContact } from './create_contact';
import { linkedDevice } from './link_device';
import { sleepFor } from './sleep_for';
import {
  getAdbFullPath,
  getAndroidSystemImageToUse,
  getEmulatorFullPath,
  getSdkManagerFullPath,
} from './binaries';

const APPIUM_PORT = 4728;

export type SupportedPlatformsType = 'android' | 'ios';

/* ******************Command to run Appium Server: *************************************
./node_modules/.bin/appium server --use-drivers=uiautomator2,xcuitest --port 8110 --use-plugins=execute-driver --allow-cors
*/

// Basic test environment is 3 devices (device1, device2, device3) and 2 users (userA, userB)
// Device 1 and 3 are linked devices by userA
export const createBasicTestEnvironment = async (
  platform: SupportedPlatformsType
): Promise<{
  devices: DeviceWrapper[];
  Alice: User;
  Bob: User;
  closeApp(): Promise<void>;
}> => {
  const [device1, device2, device3] = await openAppMultipleDevices(platform, 3);
  const userA = await linkedDevice(device1, device3, USERNAME.ALICE);
  const userB = await newUser(device2, USERNAME.BOB);
  await newContact(platform, device1, userA, device2, userB);
  const closeApp = async (): Promise<void> => {
    await Promise.all([compact([device1, device2, device3]).map(d => d.deleteSession())]);
    console.info('sessions closed');
  };
  return {
    devices: [device1, device2, device3],
    Alice: userA,
    Bob: userB,
    closeApp,
  };
};

export const setUp1o1TestEnvironment = async (platform: SupportedPlatformsType) => {
  const [device1, device2, device3] = await openAppMultipleDevices(platform, 3);
  const userA = await linkedDevice(device1, device3, USERNAME.ALICE);
  const userB = await newUser(device2, USERNAME.BOB);
  await newContact(platform, device1, userA, device2, userB);

  return { device1, device2, device3, userA, userB };
};

export const openAppMultipleDevices = async (
  platform: SupportedPlatformsType,
  numberOfDevices: number
): Promise<DeviceWrapper[]> => {
  // Create an array of promises for each device
  const devicePromises = Array.from({ length: numberOfDevices }, (_, index) =>
    openAppOnPlatform(platform, index as CapabilitiesIndexType)
  );

  // Use Promise.all to wait for all device apps to open
  const apps = await Promise.all(devicePromises);

  //  Map the result to return only the device objects
  return apps.map(app => app.device);
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
  platform: SupportedPlatformsType
): Promise<{
  device: DeviceWrapper;
}> => {
  return openAppOnPlatform(platform, 0);
};

export const openAppTwoDevices = async (
  platform: SupportedPlatformsType
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
}> => {
  const [app1, app2] = await Promise.all([
    openAppOnPlatform(platform, 0),
    openAppOnPlatform(platform, 1),
  ]);

  return { device1: app1.device, device2: app2.device };
};

export const openAppThreeDevices = async (
  platform: SupportedPlatformsType
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

  return {
    device1: app1.device,
    device2: app2.device,
    device3: app3.device,
  };
};

export const openAppFourDevices = async (
  platform: SupportedPlatformsType
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

  return {
    device1: app1.device,
    device2: app2.device,
    device3: app3.device,
    device4: app4.device,
  };
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
  const parrallelIndex = process.env.TEST_PARALLEL_INDEX || '1';
  console.info('process.env.TEST_PARALLEL_INDEX:', process.env.TEST_PARALLEL_INDEX, parrallelIndex);
  const parrallelIndexNumber = parseInt(parrallelIndex);
  const actualCapabilitiesIndex = capabilitiesIndex + 4 * parrallelIndexNumber;

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

  // Calculate the actual capabilities index for the current worker
  const actualCapabilitiesIndex =
    capabilitiesIndex + 4 * parseInt(process.env.TEST_PARALLEL_INDEX || '0');

  const opts: XCUITestDriverOpts = {
    address: `http://localhost:${APPIUM_PORT}`,
  } as XCUITestDriverOpts;

  const capabilities = getIosCapabilities(actualCapabilitiesIndex as CapabilitiesIndexType);
  const udid = capabilities.alwaysMatch['appium:udid'] as string;

  const { device: wrappedDevice } = await cleanPermissions(opts, udid, capabilities);
  return { device: wrappedDevice };
};
// TODO UPDATE THIS TO TAKE A VARIABLE COUNT OF ARGUMENTS THAT IS NOT AN ARRAY
export const closeApp = async (
  device1?: DeviceWrapper,
  device2?: DeviceWrapper,
  device3?: DeviceWrapper,
  device4?: DeviceWrapper,
  device5?: DeviceWrapper,
  device6?: DeviceWrapper,
  device7?: DeviceWrapper,
  device8?: DeviceWrapper,
  device9?: DeviceWrapper,
  device10?: DeviceWrapper,
  device11?: DeviceWrapper,
  device12?: DeviceWrapper
) => {
  await Promise.all(
    compact([
      device1,
      device2,
      device3,
      device4,
      device5,
      device6,
      device7,
      device8,
      device9,
      device10,
      device11,
      device12,
    ]).map(d => d.deleteSession())
  );

  console.info('sessions closed');
};
