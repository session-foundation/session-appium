import { androidIt, iosIt } from "../../types/sessionIt";
import { sleepFor } from "./utils";
import { newUser } from "./utils/create_account";
import { newContact } from "./utils/create_contact";
import { linkedDevice } from "./utils/link_device";
import {
  SupportedPlatformsType,
  openAppTwoDevices,
  closeApp,
  openAppThreeDevices,
} from "./utils/open_app";

iosIt("Send image", sendImageIos);
androidIt("Send image", sendImageAndroid);

async function sendImageIos(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, "Alice", platform),
    newUser(device2, "Bob", platform),
  ]);
  const testMessage = "Ron Swanson doesn't like birthdays";

  await newContact(platform, device1, userA, device2, userB);
  await device1.sendImage(platform, "1:1", testMessage);
  await device2.clickOnByAccessibilityID("Untrusted attachment message");
  await sleepFor(500);
  // User B - Click on 'download'
  await device2.clickOnByAccessibilityID("Download media");
  // Reply to message
  await device2.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message body",
    text: testMessage,
  });
  const replyMessage = await device2.replyToMessage(userA, testMessage);
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message body",
    text: replyMessage,
  });
  // Close app and server
  await closeApp(device1, device2);
}

async function sendImageAndroid(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create user with linked device
  const userA = await linkedDevice(device1, device3, "Alice", platform);
  // Create user B
  const userB = await newUser(device2, "Bob", platform);
  const testMessage = "Sending image from Alice to Bob";
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  await device3.clickOnElementAll({
    strategy: "accessibility id",
    selector: "Conversation list item",
    text: userB.userName,
  });
  // Send test image to bob from Alice (device 1)
  await device1.sendImageWithMessageAndroid(testMessage);
  // Trust message on device 2 (bob)
  await device2.clickOnByAccessibilityID("Untrusted attachment message");
  // User B - Click on 'download'
  await device2.clickOnByAccessibilityID("Download media", 5000);
  // Wait for image to load (unclickable if not loaded correctly)
  // Check device 2 and linked device (device 3) for image
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Message body",
      text: testMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Message body",
      text: testMessage,
    }),
  ]);
  // Reply to message (on device 2 - Bob)
  const replyMessage = await device2.replyToMessage(userA, testMessage);
  await device1.waitForTextElementToBePresent({
    strategy: "accessibility id",
    selector: "Message body",
    text: replyMessage,
  });

  // Close app and server
  await closeApp(device1, device2, device3);
}
