import { DeviceWrapper } from "../../../types/DeviceWrapper";
import { ConversationType, MergedOptions } from "../../../types/testing";
import { SupportedPlatformsType } from "./open_app";
import { sleepFor } from "./sleep_for";

export const setDisappearingMessage = async (
  platform: SupportedPlatformsType,
  device: DeviceWrapper,
  [conversationType, timerType, timerDuration]: MergedOptions,
  device2?: DeviceWrapper
) => {
  const enforcedType: ConversationType = conversationType;
  await device.clickOnElement("More options");
  await sleepFor(500);
  if (platform === "ios") {
    device.clickOnElement("Disappearing Messages");
  } else {
    device.clickOnElementAll({
      strategy: "id",
      selector: `network.loki.messenger:id/title`,
      text: "Disappearing messages",
    });
  }
  if (enforcedType === "1:1") {
    await device.clickOnElement(timerType);
  }
  await device.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "1 day",
  });

  await device.disappearRadioButtonSelected("1 day");
  await device.clickOnElement(timerDuration);
  await device.clickOnElement("Set button");
  await sleepFor(1000);
  if (device2) {
    await device2.clickOnElementAll({
      strategy: "accessibility id",
      selector: "Follow setting",
    });
    await sleepFor(500);
    await device2.clickOnElementAll({
      strategy: "accessibility id",
      selector: "Set button",
    });
  }
};
