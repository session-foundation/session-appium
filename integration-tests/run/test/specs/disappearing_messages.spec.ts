import { androidIt, iosIt } from "../../types/sessionIt";
import { runOnlyOnAndroid, runOnlyOnIOS, sleepFor } from "./utils";
import { newUser } from "./utils/create_account";
import { newContact } from "./utils/create_contact";
import { createGroup } from "./utils/create_group";
import {
  SupportedPlatformsType,
  closeApp,
  openAppOnPlatformSingleDevice,
  openAppThreeDevices,
  openAppTwoDevices,
} from "./utils/open_app";

// async function disappearingMessagesLegacy(platform: SupportedPlatformsType) {
//   const { device1, device2 } = await openAppTwoDevices(platform);
//   // Create user A and user B
//   const [userA, userB] = await Promise.all([
//     newUser(device1, "Alice", platform),
//     newUser(device2, "Bob", platform),
//   ]);
//   // Create contact
//   await newContact(platform, device1, userA, device2, userB);
//   // Click conversation options menu (three dots)
//   await device1.clickOnElement("More options");
//   // Select disappearing messages option
//   await runOnlyOnIOS(platform, () =>
//     device1.clickOnElement("Disappearing Messages")
//   );
//   await sleepFor(1000);
//   await runOnlyOnAndroid(platform, () =>
//     device1.clickOnTextElementById(
//       `network.loki.messenger:id/title`,
//       "Disappearing messages"
//     )
//   );
//   // Select 5 seconds
//   await device1.clickOnElementByText({
//     strategy: "id",
//     selector: "5 seconds",
//     text: "5 seconds",
//   });
//   await device1.clickOnElement("Save button");
//   await device1.navigateBack(platform);
//   // Check control message for User A
//   await device1.waitForControlMessageToBePresent(
//     `You set disappearing message time to 5 seconds`
//   );
//   // Check config message for User B
//   await device2.waitForControlMessageToBePresent(
//     `${userA.userName} set disappearing message time to 5 seconds`
//   );
//   // Send message
//   const message = "Howdy testing disappearing messages";
//   await device1.inputText("accessibility id", "Message input box", message);
//   await device1.clickOnElement("Send message button");
//   // Wait 5 seconds
//   await sleepFor(10000);
//   // Look for message for User A
//   await device1.hasTextElementBeenDeleted("Message body", message);
//   // Look for message for User B
//   await device2.hasTextElementBeenDeleted("Message body", message);
//   await closeApp(device1, device2);
// }

async function disappearAfterSend(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
  ]);
  const testMessage = "Checking disappear after send is working";
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // Click conversation options menu (three dots)
  await device1.clickOnElement("More options");
  // Select disappearing messages option
  await runOnlyOnIOS(platform, () =>
    device1.clickOnElement("Disappearing Messages")
  );
  await sleepFor(1000);
  await runOnlyOnAndroid(platform, () =>
    device1.clickOnTextElementById(
      `network.loki.messenger:id/title`,
      "Disappearing messages"
    )
  );
  await device1.clickOnElement("Disappear after send option");
  // Need to validate that default time is checked somehow
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "1 day",
  });

  await device1.disappearRadioButtonSelected("1 day");
  // Change timer to ten seconds (testing time)
  await device1.clickOnElement("10 seconds");
  // Click on set to save setting
  await device1.clickOnElement("Set button");
  await runOnlyOnIOS(platform, () => device1.navigateBack(platform));
  await device1.waitForControlMessageToBePresent(
    `You set your messages to disappear 10 seconds after they have been sent.`
  );
  await device2.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Follow setting",
  });
  await sleepFor(100);
  await device2.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Set button",
  });
  // Check control message is correct on device 2
  await device2.waitForControlMessageToBePresent(
    `${userA.userName} has set their messages to disappear 10 seconds after they have been sent.`
  );
  // Send message to verify that deletion is working
  await device1.sendMessage(testMessage);
  await device2.clickOnElementByText({
    strategy: "accessibility id",
    selector: "Message body",
    text: testMessage,
  });
  // Wait for 10 seconds
  await sleepFor(10000);
  // Check if message is deleted in device 1
  await device1.hasTextElementBeenDeleted("Message body", testMessage);
  // Check on device 2
  await device1.hasTextElementBeenDeleted("Message body", testMessage);
  // Great success
  await closeApp(device1, device2);
}

async function disappearAfterRead(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
  ]);
  const testMessage = "Checking disappear after read is working";
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // Click conversation options menu (three dots)
  await device1.clickOnElement("More options");
  // Select disappearing messages option
  await runOnlyOnIOS(platform, () =>
    device1.clickOnElement("Disappearing Messages")
  );
  await sleepFor(1000);
  await runOnlyOnAndroid(platform, () =>
    device1.clickOnTextElementById(
      `network.loki.messenger:id/title`,
      "Disappearing messages"
    )
  );
  await device1.clickOnElement("Disappear after read option");
  // Need to validate that default time is checked somehow
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "12 hours",
  });
  await device1.disappearRadioButtonSelected("12 hours");
  // Change timer to ten seconds (testing time)
  await device1.clickOnElement("10 seconds");
  // Click on set to save setting
  await device1.clickOnElement("Set button");
  await runOnlyOnIOS(platform, () => device1.navigateBack(platform));
  await sleepFor(1000);
  await device1.waitForControlMessageToBePresent(
    `You set your messages to disappear 10 seconds after they have been read.`
  );
  await device2.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Follow setting",
  });
  await sleepFor(100);
  await device2.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Set button",
  });
  // Check control message is correct on device 2
  await device2.waitForControlMessageToBePresent(
    `${userA.userName} has set their messages to disappear 10 seconds after they have been read.`
  );
  // Send message to verify that deletion is working
  await device1.sendMessage(testMessage);
  // Wait for 10 seconds
  await sleepFor(10000);
  // Check if message is deleted in device 1
  await device1.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Message body",
    text: testMessage,
    maxWait: 1000,
  });
  // await sleepFor(9000);
  // Check on device 2
  await device2.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Message body",
    text: testMessage,
    maxWait: 1000,
  });
  // Great success
  await closeApp(device1, device2);
}
// TO FIX CONTROL MESSAGE FOR `YOU HAVE SET...` WRONG
async function disappearAfterSendGroups(platform: SupportedPlatformsType) {
  const testGroupName = "Disappear after send test";
  const testMessage = "Testing disappear after sent in groups";
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);
  // Create contact between User A and User B
  await createGroup(
    platform,
    device1,
    userA,
    device2,
    userB,
    device3,
    userC,
    testGroupName
  );
  await device1.clickOnElement("More options");
  // Select disappearing messages option
  await runOnlyOnIOS(platform, () =>
    device1.clickOnElement("Disappearing Messages")
  );
  await sleepFor(1000);
  await runOnlyOnAndroid(platform, () =>
    device1.clickOnTextElementById(
      `network.loki.messenger:id/title`,
      "Disappearing messages"
    )
  );
  // Check the default time is set to
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "1 day",
  });
  await device1.disappearRadioButtonSelected("1 day");
  // Change time to testing time of 10 seconds
  await device1.clickOnElement("30 seconds");
  // Save setting
  await device1.clickOnElement("Set button");
  await runOnlyOnIOS(platform, () => device1.navigateBack(platform));
  // Check control message
  await Promise.all([
    device1.waitForControlMessageToBePresent(
      `You have set messages to disappear 30 seconds after they have been sent`
    ),
    device2.waitForControlMessageToBePresent(
      `${userA.userName} has set their messages to disappear 30 seconds after they have been sent.`
    ),
    device3.waitForControlMessageToBePresent(
      `${userA.userName} has set their messages to disappear 30 seconds after they have been sent.`
    ),
  ]);
  // Send message to verify deletion
  await device1.sendMessage(testMessage);
  // Wait for ten seconds
  await sleepFor(30000);
  // Check for test messages (should be deleted)
  await Promise.all([
    device1.hasTextElementBeenDeleted("Message body", testMessage),
    device2.hasTextElementBeenDeleted("Message body", testMessage),
    device3.hasTextElementBeenDeleted("Message body", testMessage),
  ]);
  // Close server and devices
  await closeApp(device1, device2, device3);
}

async function disappearAfterSendNoteToSelf(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  const testMessage = `Testing disappearing messages in Note to Self`;
  const userA = await newUser(device, "Alice", platform);
  // Send message to self to bring up Note to Self conversation
  await device.clickOnElement("New conversation button");
  await device.clickOnElement("New direct message");
  await device.inputText(
    "accessibility id",
    "Session id input box",
    userA.sessionID
  );
  await device.scrollDown();
  await device.clickOnElement("Next");
  await device.inputText(
    "accessibility id",
    "Message input box",
    "Creating note to self"
  );
  await device.clickOnElement("Send message button");
  // Enable disappearing messages
  await device.clickOnElement("More options");
  await sleepFor(500);
  await runOnlyOnIOS(platform, () =>
    device.clickOnElement("Disappearing Messages")
  );
  await sleepFor(1000);
  await runOnlyOnAndroid(platform, () =>
    device.clickOnTextElementById(
      `network.loki.messenger:id/title`,
      "Disappearing messages"
    )
  );
  // Check default timer is set
  await sleepFor(1000);
  await device.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "1 day",
  });
  await device.disappearRadioButtonSelected("1 day");
  await device.clickOnElement("10 seconds");
  await device.clickOnElement("Set button");
  await runOnlyOnIOS(platform, () => device.navigateBack(platform));
  await sleepFor(1000);
  // await Promise.all([
  //   device.waitForControlMessageToBePresent(
  //     `${userA.userName} has set their messages to disappear 10 seconds after they have been sent.`
  //   ),
  //   device.waitForControlMessageToBePresent(
  //     `${userA.userName} has set their messages to disappear 10 seconds after they have been sent.`
  //   ),
  // ]);
  await device.sendMessage(testMessage);
  await sleepFor(10000);
  await device.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Message body",
    text: testMessage,
    maxWait: 1000,
  });
  // Great success
  await closeApp(device);
}

describe("Disappearing messages", () => {
  // iosIt("Disappearing messages legacy", disappearingMessagesLegacy);
  // androidIt("Disappearing messages legacy", disappearingMessagesLegacy);

  iosIt("Disappear after send", disappearAfterSend);
  androidIt("Disappear after send", disappearAfterSend);

  iosIt("Disappear after read", disappearAfterRead);
  androidIt("Disappear after read", disappearAfterRead);

  iosIt("Disappear after send groups", disappearAfterSendGroups);
  androidIt("Disappear after send groups", disappearAfterSendGroups);

  iosIt("Disappear after send note to self", disappearAfterSendNoteToSelf);
  androidIt("Disappear after send note to self", disappearAfterSendNoteToSelf);
});
