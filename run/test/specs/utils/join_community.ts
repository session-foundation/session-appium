import { DeviceWrapper } from "../../../types/DeviceWrapper";
import { SupportedPlatformsType } from "./open_app";

export const joinCommunity = async (
  platform: SupportedPlatformsType,
  device: DeviceWrapper,
  communityLink: string,
  communityName: string,
) => {
  await device.clickOnElement("New conversation button");
  if (platform === "ios") {
    await device.clickOnElement("Join Community");
    await device.inputText("accessibility id", "Enter Community URL", communityLink);
    await device.clickOnElement("Join");
    // Wait for community to load
    await device.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Conversation header name",
      text: communityName,
    });
  } else {
    // TO FIX (ISSUE WITH ACCESS ID JOIN COMMUNITY?)
    await device.clickOnElement("Join community");
    await device.inputText("accessibility id", "Community input", communityLink);
    await device.clickOnElement("Join community button");
    await device.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Username",
      text: communityName,
    });
  }
};
