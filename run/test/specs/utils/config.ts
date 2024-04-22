import * as config from "config";

import { ConfigType } from "../../../../config/default";

const typedConfig: ConfigType = config as any;

function getFromConfigOrThrow(key: string) {
  const slices = key.split(".");

  let value = "";

  switch (slices[0]) {
    case "programs":
      switch (slices[1]) {
        case "adbPath":
          value = typedConfig.programs.adbPath;
          break;
        case "emulatorPath":
          value = typedConfig.programs.emulatorPath;
          break;
        case "sdkManagerPath":
          value = typedConfig.programs.sdkManagerPath;
          break;
        case "androidSystemImage":
          value = typedConfig.programs.androidSystemImage;
          break;
        default:
          throw new Error("unhandled case programs");
      }
      break;
    case "testedApps":
      switch (slices[1]) {
        case "ios":
          value = typedConfig.testedApps.ios;
          break;
        case "android":
          value = typedConfig.testedApps.android;
          break;

        default:
          throw new Error("unhandled case testedApps");
      }
      break;
    case "emulators":
      switch (slices[1]) {
        case "ios":
          switch (slices[2]) {
            case "first":
              value = typedConfig.emulators.ios.first;
              break;
            case "second":
              value = typedConfig.emulators.ios.second;
              break;
            case "third":
              value = typedConfig.emulators.ios.third;
              break;
            case "fourth":
              value = typedConfig.emulators.ios.fourth;
              break;
            default:
              throw new Error(`unhandled case emulators ios: ${slices[2]}`);
          }
          break;
        case "android":
          switch (slices[2]) {
            case "first":
              value = typedConfig.emulators.android.first;
              break;
            case "second":
              value = typedConfig.emulators.android.second;
              break;
            case "third":
              value = typedConfig.emulators.android.third;
              break;
            case "fourth":
              value = typedConfig.emulators.android.fourth;
              break;
            default:
              throw new Error(`unhandled case emulators android ${slices[2]}`);
          }
          break;

        default:
          throw new Error(`unhandled case emulators:${slices[1]}`);
      }
      break;
    default:
      throw new Error(`unhandled case:${slices[0]}`);
  }

  if (!value || !value.length) {
    throw new Error(`config:get key not found: '${key}'`);
  }
  return value;
}

export function getAdbFullPath() {
  const key = "programs.adbPath";
  return getFromConfigOrThrow(key);
}

export function getEmulatorFullPath() {
  const key = "programs.emulatorPath";
  return getFromConfigOrThrow(key);
}

export function getSdkManagerFullPath() {
  const key = "programs.sdkManagerPath";
  return getFromConfigOrThrow(key);
}

export function getAndroidSystemImageToUse() {
  const key = "programs.androidSystemImage";
  return getFromConfigOrThrow(key);
}

export function getAndroidAppFulPath() {
  const key = "testedApps.android";
  return getFromConfigOrThrow(key);
}

export function getIosAppFulPath() {
  const key = "testedApps.ios";

  return getFromConfigOrThrow(key);
}

export function getIosFirstSimulator() {
  const key = "emulators.ios.first";

  return getFromConfigOrThrow(key);
}

export function getIosSecondSimulator() {
  const key = "emulators.ios.second";
  return getFromConfigOrThrow(key);
}

export function getIosThirdSimulator() {
  const key = "emulators.ios.third";
  return getFromConfigOrThrow(key);
}

export function getIosFourthSimulator() {
  const key = "emulators.ios.fourth";
  return getFromConfigOrThrow(key);
}

export function getAndroidFirstSimulator() {
  const key = "emulators.android.first";
  return getFromConfigOrThrow(key);
}

export function getAndroidSecondSimulator() {
  const key = "emulators.android.second";
  return getFromConfigOrThrow(key);
}

export function getAndroidThirdSimulator() {
  const key = "emulators.android.third";
  return getFromConfigOrThrow(key);
}

export function getAndroidFourthSimulator() {
  const key = "emulators.android.fourth";
  return getFromConfigOrThrow(key);
}
