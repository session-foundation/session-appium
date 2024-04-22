/* eslint-disable @typescript-eslint/no-unused-vars */
import { getAndroidCapabilities, getAndroidUdid } from "./capabilities_android";
import { CapabilitiesIndexType, getIosCapabilities } from "./capabilities_ios";
import { installAppToDeviceName, runScriptAndLog } from "./utilities";

import * as androidDriver from "appium-uiautomator2-driver";
import * as iosDriver from "appium-xcuitest-driver";

import { DriverOpts } from "appium/build/lib/appium";
import { compact } from "lodash";
import { DeviceWrapper } from "../../../types/DeviceWrapper";
import {
  getAdbFullPath,
  getAndroidAppFulPath,
  getAndroidSystemImageToUse,
  getEmulatorFullPath,
  getSdkManagerFullPath,
} from "./config";
import { sleepFor } from "./sleep_for";

const APPIUM_PORT = 4728;

export type SupportedPlatformsType = "android" | "ios";

/* ******************Command to run Appium Server: *************************************
./node_modules/.bin/appium server --use-drivers=uiautomator2,xcuitest --port 8110 --use-plugins=execute-driver --allow-cors
*/

const openAppOnPlatform = async (
  platform: SupportedPlatformsType,
  capabilitiesIndex: CapabilitiesIndexType,
): Promise<{
  device: DeviceWrapper;
}> => {
  return platform === "ios" ? openiOSApp(capabilitiesIndex) : openAndroidApp(capabilitiesIndex);
};

export const openAppOnPlatformSingleDevice = async (
  platform: SupportedPlatformsType,
): Promise<{
  device: DeviceWrapper;
}> => {
  return openAppOnPlatform(platform, 0);
};

export const openAppTwoDevices = async (
  platform: SupportedPlatformsType,
): Promise<{
  device1: DeviceWrapper;
  device2: DeviceWrapper;
}> => {
  const [app1, app2] = await Promise.all([openAppOnPlatform(platform, 0), openAppOnPlatform(platform, 1)]);

  return { device1: app1.device, device2: app2.device };
};

export const openAppThreeDevices = async (
  platform: SupportedPlatformsType,
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
  platform: SupportedPlatformsType,
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
  const installSystemImageCmd = `${getSdkManagerFullPath()} --install '${getAndroidSystemImageToUse()}'`;
  console.warn(installSystemImageCmd);
  await runScriptAndLog(installSystemImageCmd);

  const createCmd = `echo "no" | ${getSdkManagerFullPath()} create avd --name ${emulatorName} -k '${getAndroidSystemImageToUse()}' --force`;
  console.warn(createCmd);
  await runScriptAndLog(createCmd);
  return emulatorName;
}

async function startAndroidEmulator(emulatorName: string) {
  await runScriptAndLog(`echo "hw.lcd.density=440" >> ~/.android/avd/${emulatorName}.avd/config.ini
  `);
  const startEmulatorCmd = `${getEmulatorFullPath()} @${emulatorName}  `;
  console.warn(`${startEmulatorCmd} & ; disown`);
  await runScriptAndLog(
    startEmulatorCmd, // -netdelay none -no-snapshot -wipe-data
  );
}

async function isEmulatorRunning(emulatorName: string) {
  const failedWith = await runScriptAndLog(`${getAdbFullPath()} -s ${emulatorName} get-state;`);

  return !failedWith || !(failedWith.includes("error") || failedWith.includes("offline"));
}

async function waitForEmulatorToBeRunning(emulatorName: string) {
  let start = Date.now();
  let found = false;

  do {
    found = await isEmulatorRunning(emulatorName);
    await sleepFor(500);
  } while (Date.now() - start < 25000 && !found);

  if (!found) {
    return;
  }

  start = Date.now();

  do {
    const bootedOrNah = await runScriptAndLog(
      `${getAdbFullPath()} -s  "${emulatorName}" shell getprop sys.boot_completed;`,
    );

    found = bootedOrNah.includes("1");

    await sleepFor(500);
  } while (Date.now() - start < 25000 && !found);

  return found;
}

const openAndroidApp = async (
  capabilitiesIndex: CapabilitiesIndexType,
): Promise<{
  device: DeviceWrapper;
}> => {
  // await killAdbIfNotAlreadyDone();
  const targetName = getAndroidUdid(capabilitiesIndex);

  const emulatorAlreadyRunning = await isEmulatorRunning(targetName);
  console.warn("emulatorAlreadyRunning", targetName, emulatorAlreadyRunning);
  if (!emulatorAlreadyRunning) {
    await createAndroidEmulator(targetName);
    void startAndroidEmulator(targetName);
  }
  await waitForEmulatorToBeRunning(targetName);
  console.log(targetName, " emulator booted");

  await installAppToDeviceName(getAndroidAppFulPath(), targetName);

  const driver = (androidDriver as any).AndroidUiautomator2Driver;

  // console.warn('installAppToDeviceName ', driver);
  console.log(`Android App Full Path: ${getAndroidCapabilities(capabilitiesIndex)["alwaysMatch"]["appium:app"] || ""}`);

  const opts: DriverOpts = {
    address: `http://localhost:${APPIUM_PORT}`,
  } as DriverOpts;

  const device: DeviceWrapper = new driver(opts);
  const wrappedDevice = new DeviceWrapper(device);

  await runScriptAndLog(`adb -s ${targetName} shell settings put global heads_up_notifications_enabled 0
  `);
  const startSession = Date.now();
  await wrappedDevice.createSession(getAndroidCapabilities(capabilitiesIndex));
  console.warn(`${Date.now() - startSession}ms taken by createSession() `);
  // this is required to make PopupWindow show up from the Android SDK
  const startUpdateSetting = Date.now();
  await (device as any).updateSettings({
    ignoreUnimportantViews: false,
    allowInvisibleElements: true,
    enableMultiWindows: true,
  });
  console.warn(`${Date.now() - startUpdateSetting}ms taken by updateSettings() `);

  return { device: wrappedDevice };
};

const openiOSApp = async (
  capabilitiesIndex: CapabilitiesIndexType,
): Promise<{
  device: DeviceWrapper;
}> => {
  console.warn("openiOSApp");

  // Logging to check that app path is correct
  console.log(`iOS App Full Path: ${getIosCapabilities(capabilitiesIndex)["alwaysMatch"]["appium:app"] || ""}`);
  const opts: DriverOpts = {
    address: `http://localhost:${APPIUM_PORT}`,
  } as DriverOpts;
  const driver = (iosDriver as any).XCUITestDriver;

  const device: DeviceWrapper = new driver(opts);
  const wrappedDevice = new DeviceWrapper(device);

  const caps = getIosCapabilities(capabilitiesIndex);
  await wrappedDevice.createSession(caps);

  return { device: wrappedDevice };
};

export const closeApp = async (
  device1?: DeviceWrapper,
  device2?: DeviceWrapper,
  device3?: DeviceWrapper,
  device4?: DeviceWrapper,
) => {
  await Promise.all(compact([device1, device2, device3, device4]).map((d) => d.deleteSession()));

  console.info("sessions closed");
};
