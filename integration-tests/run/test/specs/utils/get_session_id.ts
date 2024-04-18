import { DeviceWrapper } from "../../../types/DeviceWrapper";
import { SupportedPlatformsType } from "./open_app";

export const saveSessionIDIos = async (device: DeviceWrapper) => {
  const selector = await device.grabTextFromAccessibilityId(
    "Session ID generated"
  );
  return selector;
};

export const getSessionID = async (
  platform: SupportedPlatformsType,
  device: DeviceWrapper
) => {
  const sessionID = await device.grabTextFromAccessibilityId("Session ID");

  return sessionID;
};
