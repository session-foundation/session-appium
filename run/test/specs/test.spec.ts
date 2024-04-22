import { androidIt, iosIt } from "../../types/sessionIt";
import { newUser } from "./utils/create_account";

import { openAppOnPlatformSingleDevice, SupportedPlatformsType } from "./utils/open_app";

async function tinyTest(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await newUser(device, "Alice", platform);
  // await device.clickOnElement("User settings");
  // await device.clickOnElementById(`Appearance`);
  // // const button = await device.waitForTextElementToBePresent(
  // //   "id",
  // //   "RadioButton"
  // // );
  // const attr = await device.getAttribute("value", button.ELEMENT);
  // if (attr === "selected") {
  //   console.log("Great success");
  // } else {
  //   throw new Error("Dammit");
  // }
}

describe("Tiny test", () => {
  iosIt("Tiny test", tinyTest);
  androidIt("Tiny test", tinyTest);
});
