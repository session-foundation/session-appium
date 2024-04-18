import { runOnlyOnAndroid, runOnlyOnIOS, sleepFor } from ".";
import { newUser } from "./create_account";
import { SupportedPlatformsType } from "./open_app";

import { DeviceWrapper } from "../../../types/DeviceWrapper";
import { Username } from "../../../types/testing";

export const linkedDevice = async (
  device1: DeviceWrapper,
  device2: DeviceWrapper,
  userName: Username,
  platform: SupportedPlatformsType
) => {
  const user = await newUser(device1, userName, platform);
  // Log in with recovery seed on device 2

  await device2.clickOnElement("Link a device");
  // Enter recovery phrase into input box
  await device2.inputText(
    "accessibility id",
    "Enter your recovery phrase",
    user.recoveryPhrase
  );
  await sleepFor(1000);
  // Continue with recovery phrase
  await device2.clickOnElement("Continue");
  // Wait for any notifications to disappear
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message Notifications",
    maxWait: 20000,
  });

  // Wait for transitiion animation between the two pages
  await await sleepFor(250);
  // Click continue on message notification settings
  await device2.clickOnElement("Continue with settings");
  // Check for recovery phrase reminder
  await sleepFor(1000);
  await runOnlyOnIOS(platform, () => device2.clickOnElement("Don’t Allow"));
  await sleepFor(1000);
  await device2.hasElementBeenDeleted("accessibility id", "Continue");
  await runOnlyOnAndroid(platform, () =>
    device2.clickOnTextElementById(
      `com.android.permissioncontroller:id/permission_allow_button`,
      "Allow"
    )
  );
  // Check that button was clicked
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "New conversation button",
  });

  console.warn("Device 3 linked");

  return user;
};
