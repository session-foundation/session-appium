import { runOnlyOnAndroid, sleepFor } from ".";
import { DeviceWrapper } from "../../../types/DeviceWrapper";
import { User } from "../../../types/testing";
import { SupportedPlatformsType } from "./open_app";

export const newContact = async (
  platform: SupportedPlatformsType,
  device1: DeviceWrapper,
  user1: User,
  device2: DeviceWrapper,
  user2: User
) => {
  await device1.sendNewMessage(user2, `${user1.userName} to ${user2.userName}`);

  // USER B WORKFLOW
  // Click on message request panel
  // Wait for push notification to disappear (otherwise appium can't find element)

  await retryRequest(device1, device2);
  await sleepFor(100);
  await device2.clickOnElement("Message requests banner");
  // Select message from User A
  await device2.clickOnElement("Message request");
  await runOnlyOnAndroid(platform, () => device2.clickOnElement("Accept message request"));
  // Type into message input box
  await device2.sendMessage(`Reply-message-${user2.userName}-to-${user1.userName}`);

  // Verify config message states message request was accepted
  await device1.waitForControlMessageToBePresent("Your message request has been accepted.");

  console.warn(`${user1.userName} and ${user2.userName} are now contacts`);
  return { user1, user2, device1, device2 };
};

export const retryRequest = async (device1: DeviceWrapper, device2: DeviceWrapper) => {
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message sent status: Sent",
  });
  const banner = await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message requests banner",
  });
  if (!banner) {
    await device1.sendMessage("Retry");
    console.log(`Retrying message request`);
  } else {
    console.log("Found message request banner: No need for retry");
  }
};
