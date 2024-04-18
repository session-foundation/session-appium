import { AppiumCapabilities } from "@wdio/types/build/Capabilities";
// import { W3CCapabilities } from "appium/build/lib/appium";
import { W3CCapabilities } from "@wdio/types/build/Capabilities";
import { isNil, isString } from "lodash";
import { CapabilitiesIndexType } from "./capabilities_ios";

// const androidAppFullPath = `/Users/emilyburton/Desktop/session-1.17.5-universal.apk`;
// const androidAppFullPath = `/Users/emilyburton/Desktop/session-1.17.4-universal-flag-ON.apk`;
// const androidAppFullPath = `/Users/emilyburton/Desktop/session-1.17.6-universal.apk`;
const androidAppFullPath = `/Users/emilyburton/Documents/session-android/app/build/outputs/apk/play/debug/session-1.18.2-universal.apk`;

const sharedCapabilities: AppiumCapabilities = {
  "appium:app": androidAppFullPath,
  "appium:platformName": "Android",
  "appium:platformVersion": "14",
  "appium:appPackage": "network.loki.messenger",
  "appium:appWaitActivity":
    "org.thoughtcrime.securesms.onboarding.LandingActivity",
  "appium:automationName": "UiAutomator2",
  "appium:newCommandTimeout": 300000,
};

const emulator1Udid = "emulator-5554";
const emulator2Udid = "emulator-5556";
const emulator3Udid = "emulator-5558";
const emulator4Udid = "emulator-5560";
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
  "appium:udid": emulator1Udid,
};
const emulatorCapabilities2: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": emulator2Udid,
};

const emulatorCapabilities3: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": emulator3Udid,
};

const emulatorCapabilities4: AppiumCapabilities = {
  ...sharedCapabilities,
  "appium:udid": emulator4Udid,
};
// const countOfAndroidCapabilities = 4;

// const uuidsList = [emulator1Udid, emulator2Udid, emulator3Udid, emulator4Udid];
// const deviceList = [physicalDevice1Udid, physicalDevice2Udid]

export const androidCapabilities = {
  sharedCapabilities,
  androidAppFullPath,
};

function getAllCaps() {
  const emulatorCaps = [
    emulatorCapabilities1,
    emulatorCapabilities2,
    emulatorCapabilities3,
    emulatorCapabilities4,
  ];
  const physicalDeviceCaps = [
    physicalDeviceCapabilities1,
    physicalDeviceCapabilities2,
  ];
  const allowPhysicalDevice = !isNil(process.env.ALLOW_PHYSICAL_DEVICES);

  const allCaps = [...physicalDeviceCaps, ...emulatorCaps];

  if (allowPhysicalDevice) {
    return allCaps;
  }
  return emulatorCaps;
}

export function getAndroidCapabilities(
  capabilitiesIndex: CapabilitiesIndexType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): W3CCapabilities {
  const allCaps = getAllCaps();
  if (capabilitiesIndex >= allCaps.length) {
    throw new Error(
      `Asked invalid android capability index: ${capabilitiesIndex}`
    );
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
