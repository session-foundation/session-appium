import { androidIt } from "../../types/sessionIt";
import { sleepFor } from "./utils";
import { newUser } from "./utils/create_account";
import { newContact } from "./utils/create_contact";
import { joinCommunity } from "./utils/join_community";
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from "./utils/open_app";
import { setDisappearingMessage } from "./utils/set_disappearing_messages";

async function disappearingImageMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testMessage = "Testing disappearing messages for images";
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ["1:1", "Disappear after send option", "30 seconds"], device2);
  // await device1.navigateBack(platform);
  await device1.sendImage(platform, testMessage);
  // Retry click on untrusted attachment message until media appears
  // const start = Date.now();
  // let tryNumber = 0;
  // let downloadMediaPresent = false;
  await device2.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Untrusted attachment message",
  });
  await device2.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Download media",
  });
  await sleepFor(10000);
  await Promise.all([
    device1.hasElementBeenDeletedNew({
      strategy: "accessibility id",
      selector: "Message body",
      maxWait: 1000,
      text: testMessage,
    }),
    device2.hasElementBeenDeletedNew({
      strategy: "accessibility id",
      selector: "Message body",
      maxWait: 1000,
      text: testMessage,
    }),
  ]);
  await closeApp(device1, device2);
}

async function disappearingVideoMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);

  await setDisappearingMessage(platform, device1, ["1:1", "Disappear after send option", "30 seconds"], device2);
  await device1.sendVideo(platform);
  await device2.clickOnElement("Untrusted attachment message");
  await device2.clickOnElement("Download media");
  // Wait for disappearing message timer to remove video
  await sleepFor(10000);
  await Promise.all([
    device1.hasElementBeenDeletedNew({
      strategy: "accessibility id",
      selector: "Media message",
    }),
    device2.hasElementBeenDeletedNew({
      strategy: "accessibility id",
      selector: "Media message",
    }),
  ]);
  await closeApp(device1, device2);
}

async function disappearingVoiceMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ["1:1", "Disappear after send option", "30 seconds"], device2);
  await device1.longPress("New voice message");
  await device1.clickOnElement("Continue");
  await device1.clickOnElementXPath(
    `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout[2]/android.widget.Button[1]`,
  );
  await device1.pressAndHold("New voice message");
  // await device1.clickOnElement("OK");
  // await device1.pressAndHold("New voice message");
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Voice message",
  });
  await device2.clickOnElement("Untrusted attachment message");
  await sleepFor(200);
  await device2.clickOnElement("Download media");
  await sleepFor(10000);
  await device1.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Voice message",
  });
  await device2.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Voice message",
  });
  await closeApp(device1, device2);
}

async function disappearingGifMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ["1:1", "Disappear after send option", "30 seconds"], device2);
  await device1.navigateBack(platform);
  // Click on attachments button
  await device1.clickOnElement("Attachments button");
  // Select GIF tab

  await device1.clickOnElement("GIF button");
  await device1.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Continue",
  });
  // Select gif
  await sleepFor(3000);
  await device1.clickOnElementXPath(
    `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.RelativeLayout/android.widget.ScrollView/androidx.viewpager.widget.ViewPager/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.FrameLayout[1]`,
  );
  // Check if the 'Tap to download media' config appears
  // Click on config
  await device2.clickOnElement("Untrusted attachment message");
  await sleepFor(100);
  // Click on 'download'
  await device2.clickOnElement("Download media");
  // Wait for 10 seconds
  await sleepFor(10000);
  // Check if GIF has been deleted on both devices
  await device1.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Media message",
    maxWait: 1000,
  });
  await device2.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Media message",
    maxWait: 1000,
  });
  await closeApp(device1, device2);
}

async function disappearingLinkMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testLink = `https://example.org/`;
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ["1:1", "Disappear after send option", "30 seconds"], device2);
  await device1.navigateBack(platform);
  // Send a link
  await device1.inputText("accessibility id", "Message input box", testLink);
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message sent status: Sent",
    maxWait: 20000,
  });
  // Accept dialog for link preview
  await device1.clickOnElement("Enable");
  // No preview on first send
  await device1.clickOnElement("Send message button");
  // Send again for image
  await device1.inputText("accessibility id", "Message input box", testLink);
  await sleepFor(100);
  await device1.clickOnElement("Send message button");
  // Make sure image preview is available in device 2
  await device2.waitForTextElementToBePresent({
    strategy: "id",
    selector: "network.loki.messenger:id/linkPreviewView",
  });
  // Wait for 10 seconds to disappear
  await sleepFor(10000);
  await device1.hasElementBeenDeletedNew({
    strategy: "id",
    selector: "network.loki.messenger:id/linkPreviewView",
    maxWait: 1000,
  });
  await device2.hasElementBeenDeletedNew({
    strategy: "id",
    selector: "network.loki.messenger:id/linkPreviewView",
    maxWait: 1000,
  });
  await closeApp(device1, device2);
}

async function disappearingCommunityInviteMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const communityLink = `https://chat.lokinet.dev/testing-all-the-things?public_key=1d7e7f92b1ed3643855c98ecac02fc7274033a3467653f047d6e433540c03f17`;
  const communityName = "Testing All The Things!";
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ["1:1", "Disappear after send option", "30 seconds"], device2);
  await device1.navigateBack(platform);
  await joinCommunity(platform, device1, communityLink, communityName);
  await device1.clickOnElement("More options");
  await device1.clickOnElement("Add Members");
  await device1.clickOnElementByText({
    strategy: "accessibility id",
    selector: "Contact",
    text: userB.userName,
  });
  await device1.clickOnElement("Done");
  // Check device 2 for invitation from user A
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Community invitation",
    text: communityName,
  });
  // Wait for 10 seconds for message to disappear
  await sleepFor(10000);
  await device2.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Message body",
    maxWait: 1000,
    text: communityName,
  });
  await device1.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Message body",
    maxWait: 1000,
    text: communityName,
  });
  await closeApp(device1, device2);
}

async function disappearingCallMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ["1:1", "Disappear after send option", "30 seconds"], device2);
  await device1.navigateBack(platform);
  await device1.clickOnElement("Call");
  // Enabled voice calls in privacy settings
  await device1.waitForTextElementToBePresent({
    strategy: "id",
    selector: "android:id/button1",
  });

  await device1.clickOnElementById("android:id/button1");
  // Scroll to bottom of page to voice and video calls
  await sleepFor(1000);
  await device1.scrollDown();
  const voicePermissions = await device1.waitForTextElementToBePresent({
    strategy: "id",
    selector: "android:id/summary",
    text: "Enables voice and video calls to and from other users.",
  });

  await device1.click(voicePermissions.ELEMENT);
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await device1.clickOnElement("Enable");
  // Navigate back to conversation
  await device1.waitForTextElementToBePresent({
    strategy: "id",
    selector: "com.android.permissioncontroller:id/permission_allow_foreground_only_button",
  });
  await device1.clickOnElementById("com.android.permissioncontroller:id/permission_allow_foreground_only_button");

  await device1.clickOnElement("Navigate up");
  // Enable voice calls on device 2 for User B
  await device2.clickOnElement("Call");
  // Enabled voice calls in privacy settings
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Settings",
    text: "Settings",
  });

  await device2.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Settings",
  });
  // Scroll to bottom of page to voice and video calls
  await sleepFor(1000);
  await device2.scrollDown();
  const voicePermissions2 = await device2.waitForTextElementToBePresent({
    strategy: "id",
    selector: "android:id/summary",
    text: "Enables voice and video calls to and from other users.",
  });

  await device2.click(voicePermissions2.ELEMENT);
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await device2.clickOnElement("Enable");
  // Navigate back to conversation
  await device2.waitForTextElementToBePresent({
    strategy: "id",
    selector: "com.android.permissioncontroller:id/permission_allow_foreground_only_button",
  });
  await device2.clickOnElementById("com.android.permissioncontroller:id/permission_allow_foreground_only_button");
  await device2.clickOnElement("Navigate up");
  // Make call on device 1 (userA)
  await device1.clickOnElement("Call");
  // Answer call on device 2
  await device2.clickOnElement("Answer call");
  // Wait 5 seconds
  await sleepFor(5000);
  // Hang up
  await device1.clickOnElementById("network.loki.messenger:id/endCallButton");
  // Check for config message 'Called User B' on device 1
  await device1.waitForControlMessageToBePresent(`Called ${userB.userName}`);
  await device2.waitForControlMessageToBePresent(`${userA.userName} called you`);
  // Wait 10 seconds for control message to be deleted
  await sleepFor(10000);
  await device1.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Control message",
    text: `You called ${userB.userName}`,
    maxWait: 1000,
  });
  await device2.hasElementBeenDeletedNew({
    strategy: "accessibility id",
    selector: "Control message",
    text: `${userA.userName} called you`,
    maxWait: 1000,
  });
  await closeApp(device1, device2);
}

describe("Disappearing messages checks", () => {
  androidIt("Disappearing messages image", disappearingImageMessage);
  androidIt("Disappearing messages video", disappearingVideoMessage);
  androidIt("Disappearing messages voice", disappearingVoiceMessage);
  androidIt("Disappearing messages gif", disappearingGifMessage);
  androidIt("Disappearing messages link", disappearingLinkMessage);
  androidIt("Disappearing messages community invite", disappearingCommunityInviteMessage);
  androidIt("Disappearing messages call history", disappearingCallMessage);
});
