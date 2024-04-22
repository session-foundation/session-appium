import { runOnlyOnAndroid, runOnlyOnIOS } from ".";
import { DeviceWrapper } from "../../../types/DeviceWrapper";
import { Group, GroupName, User } from "../../../types/testing";
import { newContact } from "./create_contact";
import { SupportedPlatformsType } from "./open_app";

export const createGroup = async (
  platform: SupportedPlatformsType,
  device1: DeviceWrapper,
  userOne: User,
  device2: DeviceWrapper,
  userTwo: User,
  device3: DeviceWrapper,
  userThree: User,
  userName: GroupName
): Promise<Group> => {
  const group: Group = { userName, userOne, userTwo, userThree };

  const userAMessage = `${userOne.userName} to ${userName}`;
  // Create contact between User A and User B
  await newContact(platform, device1, userOne, device2, userTwo);
  await device1.navigateBack(platform);
  await newContact(platform, device1, userOne, device3, userThree);
  await device2.navigateBack(platform);
  // Create contact between User A and User C
  // Exit conversation back to list
  await device1.navigateBack(platform);
  // Exit conversation back to list
  await device3.navigateBack(platform);
  // Click plus button
  await device1.clickOnElement("New conversation button");
  // Select Closed Group option
  await device1.clickOnElement("Create group");
  // Type in group name
  await device1.inputText("accessibility id", "Group name input", userName);
  // Select User B and User C
  await device1.selectByText("Contact", userTwo.userName);
  await device1.selectByText("Contact", userThree.userName);
  // Select tick
  await device1.clickOnElement("Create group");
  // Check for empty state on ios
  await runOnlyOnIOS(platform, () =>
    device1.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Empty list",
      maxWait: 5000,
    })
  );
  await runOnlyOnAndroid(platform, () => device1.waitForControlMessageToBePresent("You created a new group.", 5000));
  // Send message from User A to group to verify all working
  await device1.sendMessage(userAMessage);
  // Send message from User B to group
  await device2.sendMessageTo(userTwo, group);
  // Send message to User C to group
  await device3.sendMessageTo(userThree, group);

  return { userName, userOne, userTwo, userThree };
};
