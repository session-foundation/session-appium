import { androidIt, iosIt } from "../../types/sessionIt";
import { newUser } from "./utils/create_account";
import { newContact } from "./utils/create_contact";
import { createGroup } from "./utils/create_group";
import { runOnlyOnAndroid, runOnlyOnIOS, sleepFor } from "./utils/index";
import { SupportedPlatformsType, closeApp, openAppFourDevices, openAppThreeDevices } from "./utils/open_app";

async function groupCreation(platform: SupportedPlatformsType) {
  const testGroupName = "Test group";
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);
  // Create contact between User A and User B and User C
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  // Close server and devices
  await closeApp(device1, device2, device3);
}

async function changeGroupNameAndroid(platform: SupportedPlatformsType) {
  const testGroupName = "Test group";
  const newGroupName = "Changed group name";
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);
  // Create group

  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  // Now change the group name

  // Click on settings or three dots
  await device1.clickOnElement("More options");
  // Click on Edit group option
  await sleepFor(1000);
  await device1.clickOnTextElementById(`network.loki.messenger:id/title`, "Edit group");

  // Click on current group name
  await device1.clickOnElement("Group name");
  await device1.inputText("accessibility id", "Group name", "   ");
  await device1.clickOnElement("Accept name change");
  // Alert should pop up 'Please enter group name', click ok
  // If ios click ok / If Android go to next step

  await device1.deleteText("Group name");
  // Enter new group name
  await device1.clickOnElement("Group name");

  await device1.inputText("accessibility id", "Group name", newGroupName);
  // Click done/apply
  await device1.clickOnElement("Accept name change");
  await device1.clickOnElementById("network.loki.messenger:id/action_apply");
  // Check config message for changed name (different on ios and android)
  // Config on Android is "You renamed the group to blah"
  await device1.waitForControlMessageToBePresent(`You renamed the group to ${newGroupName}`);

  await closeApp(device1, device2, device3);
}

async function changeGroupNameIos(platform: SupportedPlatformsType) {
  const testGroupName = "Test group";
  const newGroupName = "Changed group name";
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);
  // Create group

  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  // Now change the group name

  // Click on settings or three dots
  await device1.clickOnElement("More options");
  // Click on Edit group option
  await sleepFor(1000);

  await device1.clickOnElement("Edit group");

  // Click on current group name
  await device1.clickOnElement("Group name");
  await device1.inputText("accessibility id", "Group name text field", "   ");
  await device1.clickOnElement("Accept name change");
  // Alert should pop up 'Please enter group name', click ok
  // If ios click ok / If Android go to next step

  await device1.clickOnElement("OK");
  // Delete empty space
  await device1.clickOnElement("Cancel");

  // Enter new group name
  await device1.clickOnElement("Group name");

  await device1.inputText("accessibility id", "Group name text field", newGroupName);
  // Click done/apply
  await device1.clickOnElement("Accept name change");

  await device1.clickOnElement("Apply changes");
  // If ios click back to match android (which goes back to conversation screen)
  // Check config message for changed name (different on ios and android)
  // Config message on ios is "Title is now blah"
  await device1.waitForControlMessageToBePresent(`Title is now '${newGroupName}'.`);
  // Config on Android is "You renamed the group to blah"

  await closeApp(device1, device2, device3);
}

async function addContactToGroup(platform: SupportedPlatformsType) {
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);
  const testGroupName = "Group to test adding contact";
  const group = await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  const userD = await newUser(device4, "Dracula", platform);
  await device1.navigateBack(platform);
  await newContact(platform, device1, userA, device4, userD);
  // Exit to conversation list
  await device1.navigateBack(platform);
  // Select group conversation in list
  await device1.selectByText("Conversation list item", group.userName);
  // Click more options
  await device1.clickOnElement("More options");
  // Select edit group
  await runOnlyOnIOS(platform, () => device1.clickOnElement("Edit group"));
  await sleepFor(1000);
  await runOnlyOnAndroid(platform, () =>
    device1.clickOnTextElementById(`network.loki.messenger:id/title`, "Edit group")
  );
  // Add contact to group
  await device1.clickOnElement("Add members");
  // Select new user
  await device1.selectByText("Contact", userD.userName);
  // Click done/apply
  await device1.clickOnElement("Done");
  // Click done/apply again
  await sleepFor(1000);
  await runOnlyOnIOS(platform, () => device1.clickOnElement("Apply changes"));
  await runOnlyOnAndroid(platform, () => device1.clickOnElementById("network.loki.messenger:id/action_apply"));
  // Check config message
  await runOnlyOnIOS(platform, () => device1.waitForControlMessageToBePresent(`${userD.userName} joined the group.`));
  await runOnlyOnAndroid(platform, () =>
    device1.waitForControlMessageToBePresent(`You added ${userD.userName} to the group.`)
  );
  // Exit to conversation list
  await device4.navigateBack(platform);
  // Select group conversation in list
  await device4.selectByText("Conversation list item", group.userName);
  // Check config
  await runOnlyOnIOS(platform, () => device4.waitForControlMessageToBePresent(`${userD.userName} joined the group.`));
  await closeApp(device1, device2, device3, device4);
}

async function mentionsForGroups(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);
  const testGroupName = "Mentions test group";
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  await device1.inputText("accessibility id", "Message input box", "@");
  // Check that all users are showing in mentions box
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Mentions list",
  });

  // Select User B
  await device1.selectByText("Contact", userB.userName);
  await device1.clickOnElement("Send message button");
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: `Message sent status: Sent`,
  });

  // Check in user B's device if the format is correct
  await device2.findMessageWithBody("@You");
  // Select User C
  await sleepFor(2000);
  await device1.inputText("accessibility id", "Message input box", "@");
  // Check that all users are showing in mentions box
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Mentions list",
  });

  // Select User B
  await device1.selectByText("Contact", userC.userName);
  await device1.clickOnElement("Send message button");
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: `Message sent status: Sent`,
    maxWait: 20000,
  });

  // Check in User C's device if the format is correct
  // await device3.findMessageWithBody(`@You`);
  //  Check User A format works
  await device3.inputText("accessibility id", "Message input box", `@`);
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Mentions list",
  });
  // Select User A
  await device3.selectByText("Contact", userA.userName);
  await device3.clickOnElement("Send message button");
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: `Message sent status: Sent`,
    maxWait: 20000,
  });
  await device1.findMessageWithBody(`@You`);
  // Close app
  await closeApp(device1, device2, device3);
}

async function leaveGroupIos(platform: SupportedPlatformsType) {
  const testGroupName = "Leave group";
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);

  // Create group with user A, user B and User C
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  await device3.clickOnElement("More options");
  await sleepFor(1000);
  await device3.clickOnElement("Leave group");
  await device3.clickOnElement("Leave");
  await device3.navigateBack(platform);
  // Check for control message
  await device2.waitForControlMessageToBePresent(`${userC.userName} left the group.`);
  await device1.waitForControlMessageToBePresent(`${userC.userName} left the group.`);
  await closeApp(device1, device2, device3);
}
// TO FIX (LEAVE GROUP CONFIRMATION ON DIALOG NOT WORKING)
async function leaveGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = "Leave group";
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
    newUser(device3, "Charlie", platform),
  ]);

  // Create group with user A, user B and User C
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  await device3.clickOnElement("More options");
  await sleepFor(1000);
  await device3.clickOnTextElementById(`network.loki.messenger:id/title`, "Leave group");
  await device3.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Yes",
  });
  // Check for control message
  await device2.waitForControlMessageToBePresent(`${userC.userName} has left the group.`);
  await device1.waitForControlMessageToBePresent(`${userC.userName} has left the group.`);
  await closeApp(device1, device2, device3);
}

describe("Group Testing", () => {
  iosIt("Create group", groupCreation);
  androidIt("Create group", groupCreation);

  iosIt("Change group name", changeGroupNameIos);
  androidIt("Change group name", changeGroupNameAndroid);

  iosIt("Add contact to group", addContactToGroup);
  androidIt("Add contact to group", addContactToGroup);

  iosIt("Test mentions", mentionsForGroups);
  androidIt("Test mentions", mentionsForGroups);

  iosIt("Leave group", leaveGroupIos);
  androidIt("Leave group", leaveGroupAndroid);
});
