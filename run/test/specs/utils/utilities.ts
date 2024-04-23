import { pick } from "lodash";
import * as util from "util";
import { sleepFor } from ".";
import { DeviceWrapper } from "../../../types/DeviceWrapper";

import { exec as execNotPromised } from "child_process";
import { getAdbFullPath } from "./config";
const exec = util.promisify(execNotPromised);

export async function runScriptAndLog(toRun: string, verbose = false): Promise<string> {
  const start = Date.now();
  try {
    if (verbose) {
      console.log("running ", toRun);
    }
    const result = await exec(toRun);

    if (result && result.stderr && !result.stderr.startsWith("All files should be loaded. Notifying the device")) {
      if (verbose) {
        console.log(`cmd which failed: "${toRun}"`);
        console.log(`result: "${result.stderr}"`);
      }
      return "".concat(result.stderr, result.stdout);
    }
    if (verbose) {
      console.log("was run: ", toRun, result);
    }
    return "".concat(result.stderr, result.stdout);
  } catch (e: any) {
    const cmd = e.cmd;
    if (verbose) {
      console.warn(`cmd which failed: "${cmd as string}"`);
      console.warn(pick(e, ["stdout", "stderr"]));
    }
    return "".concat(e.stderr as string, e.stdout as string);
  } finally {
    console.info(`${Date.now() - start}ms taken by: "${toRun}"`);
  }
}

/**
 * Somehow, the install process of appium dependencies and the application itself is not reliable.
 * This function makes sure to clean anything related to appium before installing our app again.
 *
 * I found out that this makes the restart a lot more reliable between test, even if it is way slower.
 * @param appFullPath
 * @param emulatorName i.e. emulator-5554 or whatever
 */
export const installAppToDeviceName = async (appFullPath: string, emulatorName: string) => {
  if (!emulatorName) {
    throw new Error("emulatorName must be set");
  }
  // await runScriptAndLog(`emulator -avd ${emulatorName}`, true);
  const adb = getAdbFullPath();

  await runScriptAndLog(`${adb} -s ${emulatorName} uninstall io.appium.uiautomator2.server`);
  await runScriptAndLog(`${adb} -s ${emulatorName} uninstall io.appium.uiautomator2.server.test`);
  // console.warn("we are at 1 and took ", Date.now() - start);
  await runScriptAndLog(`${adb} -s ${emulatorName} uninstall io.appium.unlock`);
  await runScriptAndLog(`${adb} -s ${emulatorName} uninstall io.appium.settings`);
  // await sleepFor(100);
  // console.warn("we are at 2 and took ", Date.now() - start);

  await runScriptAndLog(
    `${adb} -s ${emulatorName} install -g ./node_modules/appium/node_modules/appium-uiautomator2-server/apks/appium-uiautomator2-server-debug-androidTest.apk`
  );
  // await sleepFor(100);
  // console.warn("we are at 3 and took ", Date.now() - start);

  await runScriptAndLog(
    `${adb} -s ${emulatorName} install -g ./node_modules/appium/node_modules/appium-uiautomator2-server/apks/appium-uiautomator2-server-v4.27.0.apk`
  );
  await sleepFor(100);
  await runScriptAndLog(
    `${adb} -s ${emulatorName} install -g ./node_modules/appium/node_modules/io.appium.settings/apks/settings_apk-debug.apk`
  );
  // await sleepFor(100);
  // console.warn("we are at 4 and took ", Date.now() - start);

  // runScriptAndLog(
  //   `${adb} -s ${emulatorName} shell am start io.appium.uiautomator2.server`
  // );
  // await sleepFor(500);

  // runScriptAndLog(
  //   `${adb} -s ${emulatorName} shell am start io.appium.uiautomator2.server.test`
  // );

  await sleepFor(100);
  await runScriptAndLog(`${adb} -s ${emulatorName} install -g -t ${appFullPath}`);

  await runScriptAndLog(`${adb} -s ${emulatorName} shell settings put global window_animation_scale 0.0`, true);
  await runScriptAndLog(`${adb} -s ${emulatorName} shell settings put global transition_animation_scale 0.0`, true);
  await runScriptAndLog(`${adb} -s ${emulatorName} shell settings put global animator_duration_scale 0.0`, true);

  // await sleepFor(100);
  // console.warn("we are at 5 and took ", Date.now() - start);
};

export const isDeviceIOS = (device: DeviceWrapper) => {
  return (device as any).originalCaps.alwaysMatch["appium:platformName"]?.toLowerCase() === "ios";
};
export const isCI = () => {
  return process.env.NODE_CONFIG_ENV === "ci";
};
export const isDeviceAndroid = (device: DeviceWrapper) => !isDeviceIOS(device);
