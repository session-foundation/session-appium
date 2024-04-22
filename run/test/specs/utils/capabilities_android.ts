import { AppiumCapabilities, W3CCapabilities } from "@wdio/types/build/Capabilities";
import { isNil, isString } from "lodash";
import { CapabilitiesIndexType } from "./capabilities_ios";
import {
  getAndroidAppFulPath,
  getAndroidFirstSimulator,
  getAndroidFourthSimulator,
  getAndroidSecondSimulator,
  getAndroidThirdSimulator,
} from "./config";

const sharedCapabilities: AppiumCapabilities = {
  "appium:app": getAndroidAppFulPath(),
  "appium:platformName": "Android",
  "appium:platformVersion": "14",
  "appium:appPackage": "network.loki.messenger",
  "appium:appWaitActivity": "org.thoughtcrime.securesms.onboarding.LandingActivity",
  "appium:automationName": "UiAutomator2",
  "appium:newCommandTimeout": 300000,
};

const physicalDevice1Udid = "99251FFAZ000TP";
const physicalDevice2Udid = "SDEDU20311000793";

export const physicalDeviceCapabilities1: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": physicalDevice1Udid,
};

export const physicalDeviceCapabilities2: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": physicalDevice2Udid,
};

const emulatorCapabilities1: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": getAndroidFirstSimulator(),
};
const emulatorCapabilities2: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": getAndroidSecondSimulator(),
};

const emulatorCapabilities3: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": getAndroidThirdSimulator(),
};

const emulatorCapabilities4: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": getAndroidFourthSimulator(),
};

function getAllCaps() {
  const emulatorCaps = [emulatorCapabilities1, emulatorCapabilities2, emulatorCapabilities3, emulatorCapabilities4];
  const physicalDeviceCaps = [physicalDeviceCapabilities1, physicalDeviceCapabilities2];
  const allowPhysicalDevice = !isNil(process.env.ALLOW_PHYSICAL_DEVICES);

  const allCaps = [...physicalDeviceCaps, ...emulatorCaps];

  if (allowPhysicalDevice) {
    return allCaps;
  }
  return emulatorCaps;
}

export function getAndroidCapabilities(
  capabilitiesIndex: CapabilitiesIndexType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): W3CCapabilities {
  const allCaps = getAllCaps();
  if (capabilitiesIndex >= allCaps.length) {
    throw new Error(`Asked invalid android capability index: ${capabilitiesIndex}`);
  }
  const cap = allCaps[capabilitiesIndex];
  return {
    firstMatch: [{}, {}],
    alwaysMatch: { ...cap },
  };
}
export function getAndroidUdid(udidIndex: CapabilitiesIndexType): string {
  const allCaps = getAllCaps();
  if (udidIndex >= allCaps.length) {
    throw new Error(`Asked invalid android udid index: ${udidIndex}`);
  }
  const cap = allCaps[udidIndex];

  const udid = cap["appium:udid"];
  if (isString(udid)) {
    return udid;
  }
  throw new Error("Udid isnt set");
}
