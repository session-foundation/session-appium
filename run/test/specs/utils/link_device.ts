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

  await device2.clickOnByAccessibilityID("Restore your session button");
  // Enter recovery phrase into input box
  await device2.inputText(
    "accessibility id",
    device2.isAndroid() ? "Recovery phrase input" : "Recovery password input",
    user.recoveryPhrase
  );

  // Wait for continue button to become active
  await sleepFor(500);
  // Continue with recovery phrase
  await device2.clickOnByAccessibilityID("Continue");
  // Wait for any notifications to disappear
  await device2.clickOnByAccessibilityID("Slow mode notifications button");
  // Click continue on message notification settings
  await device2.clickOnByAccessibilityID("Continue");
  // Wait for loading animation to look for display name
  await device2.waitForLoadingOnboarding();
  const displayName = await device2.doesElementExist({
    strategy: "accessibility id",
    selector: "Enter display name",
    maxWait: 1000,
  });
  if (displayName) {
    await device2.inputText("accessibility id", "Enter display name", userName);
    await device2.clickOnByAccessibilityID("Continue");
  } else {
    console.warn("Display name found: Loading account");
  }
  // Wait for permissions modal to pop up
  await sleepFor(500);
  await device2.checkPermissions(platform);
  await sleepFor(1000);
  await device2.hasElementBeenDeleted({
    strategy: "accessibility id",
    selector: "Continue",
  });
  // Check that button was clicked
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "New conversation button",
  });

  console.warn("Device 3 linked");

  return user;
};
