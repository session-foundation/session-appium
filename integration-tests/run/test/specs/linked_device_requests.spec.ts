import { androidIt, iosIt } from "../../types/sessionIt";
import { runOnlyOnAndroid, runOnlyOnIOS, sleepFor } from "./utils";
import { newUser } from "./utils/create_account";
import { linkedDevice } from "./utils/link_device";
import {
  closeApp,
  openAppThreeDevices,
  SupportedPlatformsType,
} from "./utils/open_app";

async function acceptRequestLinked(platform: SupportedPlatformsType) {
  // Check 'accept' button
  // Open app
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create two users
  const userA = await newUser(device1, "Alice", platform);
  const userB = await linkedDevice(device2, device3, "Bob", platform);

  // Send message from Alice to Bob
  await device1.sendNewMessage(userB, `${userA.userName} to ${userB.userName}`);
  // Wait for banner to appear

  // Bob clicks on message request banner
  await device2.clickOnElement("Message requests banner");
  // Bob clicks on request conversation item
  await device2.clickOnElement("Message request");
  // Check device 3 (linked device) if message request has synced
  await device3.clickOnElement("Message requests banner");
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message request",
  });

  // Bob clicks accept button on device 2 (original device)
  await device2.clickOnElement("Accept message request");
  // Verify config message for Alice 'Your message request has been accepted'
  await device1.waitForControlMessageToBePresent(
    "Your message request has been accepted."
  );

  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "No pending message requests",
  });
  // Check conversation list for new contact (user A)
  await device3.navigateBack(platform);
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Conversation list item",
    text: userA.userName,
  });
  // Close app
  await closeApp(device1, device2, device3);
}

async function declineRequestLinked(platform: SupportedPlatformsType) {
  // Check 'decline' button
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create two users
  const userA = await newUser(device1, "Alice", platform);
  const userB = await linkedDevice(device2, device3, "Bob", platform);
  // Send message from Alice to Bob
  await device1.sendNewMessage(userB, `${userA.userName} to ${userB.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnElement("Message requests banner");
  // Bob clicks on request conversation item
  await device2.clickOnElement("Message request");
  // Check message request appears on linked device (device 3)
  await device3.clickOnElement("Message requests banner");
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message request",
  });
  // Click on decline button
  await runOnlyOnIOS(platform, () =>
    device2.clickOnElement("Delete message request")
  );
  await runOnlyOnAndroid(platform, () =>
    device2.clickOnElement("Decline message request")
  );
  // Are you sure you want to delete message request only for ios
  await sleepFor(3000);
  await runOnlyOnIOS(platform, () => device2.clickOnElement("Confirm delete"));

  // Navigate back to home page
  await sleepFor(100);
  await device2.navigateBack(platform);
  // Look for new conversation button to make sure it all worked
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "New conversation button",
  });
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "No pending message requests",
  });
  // Close app
  await closeApp(device1, device2, device3);
}

async function blockedRequestLinked(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);

  const userA = await newUser(device1, "Alice", platform);
  const userB = await linkedDevice(device2, device3, "Bob", platform);
  // Send message from Alice to Bob
  await device1.sendNewMessage(userB, `${userA.userName} to ${userB.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnElement("Message requests banner");
  // Bob clicks on request conversation item
  await device2.clickOnElement("Message request");
  // Check on linked device for message request
  await device3.clickOnElement("Message requests banner");
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message request",
  });
  // Bob clicks on block option
  await device2.clickOnElement("Block message request");
  // Confirm block on android
  await sleepFor(1000);
  await runOnlyOnIOS(platform, () => device2.clickOnElement("Block"));
  await runOnlyOnAndroid(platform, () =>
    device2.clickOnElement("Confirm block")
  );
  const blockedMessage = `"${userA.userName} to ${userB.userName} - shouldn't get through"`;
  await device1.sendMessage(blockedMessage);
  await device2.navigateBack(platform);

  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "New conversation button",
  });
  // Need to wait to see if message gets through
  await sleepFor(5000);
  await device2.hasTextElementBeenDeleted("Message body", blockedMessage);
  // Close app
  await closeApp(device1, device2, device3);
}

describe("Linked device - message request tests", () => {
  iosIt("Accept request syncs", acceptRequestLinked);
  androidIt("Accept request syncs", acceptRequestLinked);

  iosIt("Decline request syncs", declineRequestLinked);
  androidIt("Decline request syncs", declineRequestLinked);

  iosIt("Blocked request syncs", blockedRequestLinked);
  androidIt("Blocked request syncs", blockedRequestLinked);
});
