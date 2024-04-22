import { androidIt, iosIt } from "../../types/sessionIt";
import { newUser } from "./utils/create_account";
import { newContact } from "./utils/create_contact";
import { joinCommunity } from "./utils/join_community";
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from "./utils/open_app";

async function sendImageCommunity(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testCommunityLink = `https://chat.lokinet.dev/testing-all-the-things?public_key=1d7e7f92b1ed3643855c98ecac02fc7274033a3467653f047d6e433540c03f17`;
  const testCommunityName = `Testing All The Things!`;
  const testMessage = "Testing sending images to communities";
  // Create user A and user B
  const [userA, userB] = await Promise.all([newUser(device1, "Alice", platform), newUser(device2, "Bob", platform)]);
  await newContact(platform, device1, userA, device2, userB);
  await Promise.all([device1.navigateBack(platform), device2.navigateBack(platform)]);
  await Promise.all([
    joinCommunity(platform, device1, testCommunityLink, testCommunityName),
    joinCommunity(platform, device2, testCommunityLink, testCommunityName),
  ]);
  await Promise.all([device1.scrollToBottom(platform), device2.scrollToBottom(platform)]);
  await device1.sendImage(platform, testMessage, true);
  await Promise.all([device1.scrollToBottom(platform), device2.scrollToBottom(platform)]);
  await device2.replyToMessage(userA, testMessage);
  // await Promise.all([
  //   device1.scrollToBottom(platform),
  //   device2.scrollToBottom(platform),
  // ]);

  await closeApp(device1, device2);
}

describe("Community message checks", () => {
  iosIt("Send image to community", sendImageCommunity);
  androidIt("Send image to community", sendImageCommunity);
});
