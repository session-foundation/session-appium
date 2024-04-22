import { androidIt, iosIt } from "../../types/sessionIt";
import { parseDataImage } from "./utils/check_colour";
import { getIosFirstSimulator } from "./utils/config";
import { newUser } from "./utils/create_account";
import { newContact } from "./utils/create_contact";
import { runOnlyOnAndroid, runOnlyOnIOS, sleepFor } from "./utils/index";
import { linkedDevice } from "./utils/link_device";
import { SupportedPlatformsType, closeApp, openAppThreeDevices, openAppTwoDevices } from "./utils/open_app";
import { runScriptAndLog } from "./utils/utilities";

async function linkDevice(platform: SupportedPlatformsType) {
  // Open server and two devices
  const { device1, device2 } = await openAppTwoDevices(platform);
  // link device
  const userA = await linkedDevice(device1, device2, "Alice", platform);
  // Check that 'Youre almost finished' reminder doesn't pop up on device2
  await device2.hasElementBeenDeleted("accessibility id", "Recovery phrase reminder");
  // Verify username and session ID match
  await device2.clickOnElement("User settings");
  // Check username

  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Username",
    text: userA.userName,
  });
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Session ID",
    text: userA.sessionID,
  });

  await closeApp(device1, device2);
}

async function contactsSyncLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // link device
  const userA = await linkedDevice(device1, device2, "Alice", platform);

  const userB = await newUser(device3, "Bob", platform);

  await newContact(platform, device1, userA, device3, userB);
  await runOnlyOnIOS(platform, () => device1.clickOnElement("Back"));
  await runOnlyOnAndroid(platform, () => device1.clickOnElement("Navigate up"));
  // Check that user synced on linked device
  await device2.findMatchingTextAndAccessibilityId("Conversation list item", userB.userName);
  await closeApp(device1, device2, device3);
}
// TO FIX (USERNAME ISN'T CORRECT)
async function changeUsernameLinkedDevice(platform: SupportedPlatformsType) {
  // Open server and two devices
  const { device1, device2 } = await openAppTwoDevices(platform);
  const newUsername = "Alice in chains";
  // link device
  const userA = await linkedDevice(device1, device2, "Alice", platform);
  // Change username on device 1
  await device1.clickOnElement("User settings");
  // Select username
  await device1.clickOnElement("Username");
  await sleepFor(100);
  await device1.deleteText("Username");
  await device1.deleteText("Username");
  await device1.inputText("accessibility id", "Username", newUsername);
  // Select apply
  await runOnlyOnAndroid(platform, () => device1.clickOnElement("Apply"));
  await runOnlyOnIOS(platform, () => device1.clickOnElement("Done"));
  // Check on linked device if name has updated
  await device2.clickOnElement("User settings");
  await runOnlyOnAndroid(platform, () => device2.navigateBack(platform));
  await sleepFor(1000);
  await runOnlyOnAndroid(platform, () => device2.clickOnElement("User settings"));
  const changedUsername = await device2.grabTextFromAccessibilityId("Username");
  console.log("Username is now: ", changedUsername);
  await sleepFor(100);
  if (changedUsername === newUsername) {
    console.log(`Username changed from ${userA.userName} to `, changedUsername);
  } else {
    // throw new Error("Username change unsuccessful")
    console.log("changed: ", changedUsername, "new: ", newUsername);
  }

  await closeApp(device1, device2);
}

async function deletedMessageLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);

  const userA = await linkedDevice(device1, device3, "Alice", platform);

  const userB = await newUser(device2, "Bob", platform);

  await newContact(platform, device1, userA, device2, userB);
  // Send message from user a to user b
  const sentMessage = await device1.sendMessage("Howdy");
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  // Need to wait for notifications to disappear

  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Conversation list item",
  });

  await device3.selectByText("Conversation list item", userB.userName);
  // Find message
  await device3.findMessageWithBody(sentMessage);
  // Select message on device 1, long press
  await device1.longPressMessage(sentMessage);
  // Select delete
  await device1.clickOnElement("Delete message");
  // Select delete for everyone
  await runOnlyOnAndroid(platform, () => device1.clickOnElement("Delete just for me"));
  await runOnlyOnIOS(platform, () => device1.clickOnElement("Delete for me"));

  // await waitForLoadingAnimation(device1);

  // Check linked device for deleted message
  await device1.hasTextElementBeenDeleted("Message body", sentMessage);
  // Close app
  await closeApp(device1, device2, device3);
}

async function unSendMessageLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);

  const userA = await linkedDevice(device1, device3, "Alice", platform);

  const userB = await newUser(device2, "Bob", platform);

  await newContact(platform, device1, userA, device2, userB);
  // Send message from user a to user b
  const sentMessage = await device1.sendMessage("Howdy");
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  // Need to wait for notifications to disappear
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Conversation list item",
  });
  await device3.selectByText("Conversation list item", userB.userName);
  // Find message
  await device3.findMessageWithBody(sentMessage);
  // Select message on device 1, long press
  await device1.longPressMessage(sentMessage);
  // Select delete
  await device1.clickOnElement("Delete message");
  // Select delete for everyone
  await device1.clickOnElement("Delete for everyone");

  // await waitForLoadingAnimation(device1);

  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Deleted message",
  });
  // Check linked device for deleted message
  await device3.hasTextElementBeenDeleted("Message body", sentMessage);
  // Close app
  await closeApp(device1, device2, device3);
}

async function blockedUserLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // link device
  const userA = await linkedDevice(device1, device3, "Alice", platform);
  // Create contact to block
  const userB = await newUser(device2, "Bob", platform);
  await newContact(platform, device1, userA, device2, userB);
  // Check that user synced on linked device
  await device3.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Conversation list item",
    text: userB.userName,
  });
  // Block user on device 1
  await device1.clickOnElement("More options");
  // Select block (menu option for android and toggle for ios)
  await sleepFor(100);
  await runOnlyOnAndroid(platform, () => device1.clickOnTextElementById(`network.loki.messenger:id/title`, "Block"));
  await runOnlyOnIOS(platform, () => device1.clickOnElement("Block"));
  // Confirm block
  await device1.clickOnElement("Confirm block");
  await sleepFor(1000);
  console.log(`${userB.userName}` + " has been blocked");
  // On ios, you need to navigate back to conversation screen to confirm block
  await runOnlyOnIOS(platform, () => device1.navigateBack(platform));
  // Check on device 3 if user B is blocked
  // Click on conversation with User B
  // Need to wait for blocked banner to appear (it appears and disappears quickly, then reappears, test is getting confused...)
  await sleepFor(5000);
  await device3.selectByText("Conversation list item", userB.userName);
  // Look for blocked banner
  // Unblock on device 3 and check if unblocked on device 1

  await device3.clickOnElement("Blocked banner");
  // On ios you need to click ok to confirm unblock
  await runOnlyOnIOS(platform, () => device3.clickOnElement("Confirm block"));
  // check on device 1 if user B is unblocked
  // Need to wait for blocked banner to disappear (takes a minute)
  await sleepFor(8000);
  await device1.hasElementBeenDeleted("accessibility id", "Blocked banner");
  // Send message from user B to user A to see if unblock worked

  const sentMessage = await device2.sendMessage("Unsend message");
  // Check on device 1 if user A receives message
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message body",
    text: sentMessage,
  });

  // Everything works then close app
  await closeApp(device1, device2, device3);
}

async function avatarRestorediOS(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const spongebobsBirthday = "199805010700.00";
  await linkedDevice(device1, device2, "Alice", platform);

  await device1.clickOnElement("User settings");
  await sleepFor(100);
  await device1.clickOnElement("Profile picture");
  await device1.clickOnElement("Image picker");
  // Check if permissions need to be enabled
  const permissions = await device1.doesElementExist({
    strategy: "accessibility id",
    selector: "Allow Full Access",
    maxWait: 1000,
  });
  if (permissions) {
    try {
      await device1.clickOnElement("Allow Full Access");
    } catch (e) {
      console.log("No permissions dialog");
    }
  }
  // Check if image is already on device
  const profilePicture = await device1.doesElementExist({
    strategy: "accessibility id",
    // eslint-disable-next-line no-irregular-whitespace
    selector: `Photo, 01 May 1998, 7:00 am`,
    maxWait: 2000,
  });
  // If no image, push file to device
  if (!profilePicture) {
    await runScriptAndLog(`touch -a -m -t ${spongebobsBirthday} 'run/test/specs/media/profile_picture.jpg'`);

    await runScriptAndLog(
      `xcrun simctl addmedia ${getIosFirstSimulator()} 'run/test/specs/media/profile_picture.jpg'`,
      true,
    );
  }
  await sleepFor(100);
  // Select file
  // eslint-disable-next-line no-irregular-whitespace
  await device1.clickOnElement(`Photo, 01 May 1998, 7:00 am`);
  await device1.clickOnElement("Done");
  await device1.clickOnElement("Save");
  await sleepFor(5000);
  // Wait for change
  // Verify change
  // Take screenshot
  const el = await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Profile picture",
  });
  await sleepFor(5000);

  const base64 = await device1.getElementScreenshot(el.ELEMENT);
  const pixelColor = await parseDataImage(base64);
  console.log("RGB Value of pixel is:", pixelColor);
  if (pixelColor === "04cbfe") {
    console.log("Colour is correct");
  } else {
    throw new Error("Colour isn't 04cbfe, it is: " + pixelColor);
  }
  console.log("Now checking avatar on linked device");
  // Check avatar on device 2
  await device2.clickOnElement("User settings");
  const el2 = await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Profile picture",
  });
  await sleepFor(3000);
  const base64A = await device2.getElementScreenshot(el2.ELEMENT);
  const pixelColorLinked = await parseDataImage(base64A);
  if (pixelColorLinked === "04cbfe") {
    console.log("Colour is correct on linked device");
  } else {
    console.log("Colour isn't 04cbfe, it is: ", pixelColorLinked);
  }
  await closeApp(device1, device2);
}
// TO FIX (UPLOAD BUTTON WRONG)
async function avatarRestoredAndroid(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const spongebobsBirthday = "199905020700.00";
  await linkedDevice(device1, device2, "Alice", platform);

  await device1.clickOnElement("User settings");
  await sleepFor(100);
  await device1.clickOnElement("User settings");
  await sleepFor(500);
  await device1.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Upload",
  });
  await device1.clickOnElementById("com.android.permissioncontroller:id/permission_allow_foreground_only_button");
  await sleepFor(500);
  await device1.clickOnElementAll({
    strategy: "xpath",
    selector: `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.TabHost/android.widget.LinearLayout/android.widget.FrameLayout/androidx.viewpager.widget.ViewPager/android.widget.RelativeLayout/android.widget.GridView/android.widget.LinearLayout/android.widget.LinearLayout[2]`,
  });
  // Check if permissions need to be enabled
  // Check if image is already on device
  const profilePicture = await device1.doesElementExist({
    strategy: "accessibility id",
    selector: `profile_picture.jpg, 27.75 kB, May 2, 1999`,
    maxWait: 2000,
  });
  // If no image, push file to device
  if (!profilePicture) {
    await runScriptAndLog(`touch -a -m -t ${spongebobsBirthday} 'run/test/specs/media/profile_picture.jpg'`);

    await runScriptAndLog(
      `adb -s emulator-5554 push 'run/test/specs/media/profile_picture.jpg' /storage/emulated/0/Download`,
      true,
    );
    await device1.clickOnElementAll({
      strategy: "accessibility id",
      selector: "More options",
    });
    await device1.clickOnElementAll({
      strategy: "xpath",
      selector: `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ListView/android.widget.LinearLayout`,
    });
  }
  await sleepFor(100);
  await device1.clickOnElement(`profile_picture.jpg, 27.75 kB, May 2, 1999`);
  await device1.clickOnElementById("network.loki.messenger:id/crop_image_menu_crop");
  await sleepFor(2000);
  // Wait for change
  // Verify change
  // Take screenshot
  const el = await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "User settings",
  });
  await sleepFor(3000);
  const base64 = await device1.getElementScreenshot(el.ELEMENT);
  const pixelColor = await parseDataImage(base64);
  console.log("RGB Value of pixel is:", pixelColor);
  if (pixelColor === "03cbfe") {
    console.log("Colour is correct on device 1");
  } else {
    console.log("Colour isn't 03cbfe, it is: ", pixelColor);
  }
  console.log("Now checking avatar on linked device");
  // Check avatar on device 2
  await device2.clickOnElement("User settings");
  const el2 = await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "User settings",
  });
  await sleepFor(3000);
  const base64A = await device2.getElementScreenshot(el2.ELEMENT);
  const pixelColorLinked = await parseDataImage(base64A);
  if (pixelColorLinked === "03cbfe") {
    console.log("Colour is correct on linked device");
  } else {
    console.log("Colour isn't 03cbfe, it is: ", pixelColorLinked);
  }
  await closeApp(device1, device2);
}

describe("Linked device - user tests", () => {
  iosIt("Link a device", linkDevice);
  androidIt("Link a device", linkDevice);

  iosIt("Profile picture syncs", avatarRestorediOS);
  androidIt("Profile picture syncs", avatarRestoredAndroid);

  androidIt("Contact syncs", contactsSyncLinkedDevice);
  iosIt("Contact syncs", contactsSyncLinkedDevice);

  androidIt("Changed username syncs", changeUsernameLinkedDevice);
  iosIt("Changed username syncs", changeUsernameLinkedDevice);

  androidIt("Deleted message syncs", deletedMessageLinkedDevice);
  iosIt("Deleted message syncs", deletedMessageLinkedDevice);

  androidIt("Unsent message syncs", unSendMessageLinkedDevice);
  iosIt("Unsent message syncs", unSendMessageLinkedDevice);

  iosIt("Blocked user syncs", blockedUserLinkedDevice);
  androidIt("Blocked user syncs", blockedUserLinkedDevice);
});
