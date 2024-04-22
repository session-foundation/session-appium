import { AppiumXCUITestCapabilities } from "@wdio/types/build/Capabilities";
import { W3CCapabilities } from "@wdio/types/build/Capabilities";
import { getIosFirstSimulator, getIosFourthSimulator, getIosSecondSimulator, getIosThirdSimulator } from "./config";
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

const capabilities1: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:udid": getIosFirstSimulator(),
  "appium:wdaLocalPort": 1253,
};
const capabilities2: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:wdaLocalPort": 1254,
  "appium:udid": getIosSecondSimulator(),
};

const capabilities3: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:udid": getIosThirdSimulator(),
  "appium:wdaLocalPort": 1255,
};

const capabilities4: AppiumXCUITestCapabilities = {
  ...sharediOSCapabilities,
  "appium:udid": getIosFourthSimulator(),
  "appium:wdaLocalPort": 1256,
};

const countOfIosCapabilities = 4;

export function getIosCapabilities(capabilitiesIndex: CapabilitiesIndexType): W3CCapabilities {
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
