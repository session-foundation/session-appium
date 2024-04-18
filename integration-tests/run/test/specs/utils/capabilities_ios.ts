import { AppiumXCUITestCapabilities } from "@wdio/types/build/Capabilities";
import { W3CCapabilities } from "@wdio/types/build/Capabilities";
const iosAppFullPath = `/Users/emilyburton/Desktop/Session.app`;
// const iosAppFullPath = `/Users/emilyburton/Desktop/Session.app`;

const sharediOSCapabilities: AppiumXCUITestCapabilities = {
  "appium:app": iosAppFullPath,
  "appium:platformName": "iOS",
  "appium:platformVersion": "17.2",
  "appium:deviceName": "iPhone 15 Pro Max",
  "appium:automationName": "XCUITest",
  "appium:bundleId": "com.loki-project.loki-messenger",
  "appium:newCommandTimeout": 300000,
  "appium:useNewWDA": false,
  "appium:showXcodeLog": false,
  "appium:autoDismissAlerts": false,
  "appium:reduceMotion": true,
  // "appium:isHeadless": true,
} as AppiumXCUITestCapabilities;
export type CapabilitiesIndexType = 0 | 1 | 2 | 3 | 4 | 5;

function getIOSSimulatorUUIDFromEnv(index: CapabilitiesIndexType): string {
  switch (index) {
    case 0:
      if (process.env.IOS_FIRST_SIMULATOR) {
        return process.env.IOS_FIRST_SIMULATOR;
      }
      throw new Error(
        `getSimulatorUUIDFromEnv process.env.IOS_FIRST_SIMULATOR is not set`
      );
    case 1:
      if (process.env.IOS_SECOND_SIMULATOR) {
        return process.env.IOS_SECOND_SIMULATOR;
      }
      throw new Error(
        `getSimulatorUUIDFromEnv process.env.IOS_SECOND_SIMULATOR is not set`
      );
    case 2:
      if (process.env.IOS_THIRD_SIMULATOR) {
        return process.env.IOS_THIRD_SIMULATOR;
      }
      throw new Error(
        `getSimulatorUUIDFromEnv process.env.IOS_THIRD_SIMULATOR is not set`
      );
    case 3:
      if (process.env.IOS_FOURTH_SIMULATOR) {
        return process.env.IOS_FOURTH_SIMULATOR;
      }
      throw new Error(
        `getSimulatorUUIDFromEnv process.env.IOS_THIRD_SIMULATOR is not set`
      );
    default:
      throw new Error(
        `getSimulatorUUIDFromEnv unknown index: ${index as number}`
      );
  }
}

const emulator1Udid = getIOSSimulatorUUIDFromEnv(0);
const emulator2Udid = getIOSSimulatorUUIDFromEnv(1);
const emulator3Udid = getIOSSimulatorUUIDFromEnv(2);
const emulator4Udid = getIOSSimulatorUUIDFromEnv(3);

const capabilities1: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:udid": emulator1Udid,
  "appium:wdaLocalPort": 1253,
};
const capabilities2: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:wdaLocalPort": 1254,
  "appium:udid": emulator2Udid,
};

const capabilities3: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:udid": emulator3Udid,
  "appium:wdaLocalPort": 1255,
};

const capabilities4: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:udid": emulator4Udid,
  "appium:wdaLocalPort": 1256,
};

const countOfIosCapabilities = 4;

export function getIosCapabilities(
  capabilitiesIndex: CapabilitiesIndexType
): W3CCapabilities {
  if (capabilitiesIndex >= countOfIosCapabilities) {
    throw new Error(`Asked invalid ios cap index: ${capabilitiesIndex}`);
  }
  const caps =
    capabilitiesIndex === 0
      ? capabilities1
      : capabilitiesIndex === 1
      ? capabilities2
      : capabilitiesIndex === 2
      ? capabilities3
      : capabilities4;

  return {
    firstMatch: [{}, {}],
    alwaysMatch: {
      ...caps,
    },
  };
}
