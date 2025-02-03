import { androidIt, iosIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

iosIt('Disappearing call message 1o1', 'low', disappearingCallMessage1o1Ios, true);
androidIt('Disappearing call message 1o1', 'low', disappearingCallMessage1o1Android, true);

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingCallMessage1o1Ios(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);

  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  // await device1.navigateBack();
  await device1.clickOnByAccessibilityID('Call');
  // Enabled voice calls in privacy settings
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  await device1.clickOnByAccessibilityID('Settings');
  // Scroll to bottom of page to voice and video calls
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await device1.modalPopup({
    strategy: 'accessibility id',
    selector: 'Allow voice and video calls',
  });
  await device1.clickOnByAccessibilityID('Continue');
  // Navigate back to conversation
  await sleepFor(500);
  await device1.clickOnByAccessibilityID('Close button');
  // Enable voice calls on device 2 for User B
  await device2.clickOnByAccessibilityID('Call');
  await device2.clickOnByAccessibilityID('Settings');
  await device2.scrollDown();
  await device2.modalPopup({
    strategy: 'accessibility id',
    selector: 'Allow voice and video calls',
  });
  await device2.clickOnByAccessibilityID('Enable');
  await sleepFor(500);
  await device2.clickOnByAccessibilityID('Close button');
  // Make call on device 1 (userA)
  await device1.clickOnByAccessibilityID('Call');
  // Answer call on device 2
  await device2.clickOnByAccessibilityID('Answer call');
  // Wait 30 seconds
  // Hang up
  await device1.clickOnByAccessibilityID('End call button');
  // Check for config message 'Called User B' on device 1
  await device1.waitForControlMessageToBePresent(`You called ${userB.userName}`);
  await device1.waitForControlMessageToBePresent(`${userA.userName} called you`);
  // Wait 30 seconds for control message to be deleted
  await sleepFor(30000);
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: `You called ${userB.userName}`,
    maxWait: 1000,
  });
  await device2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: `${userA.userName} called you`,
    maxWait: 1000,
  });
  await closeApp(device1, device2);
}

async function disappearingCallMessage1o1Android(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);

  // await device1.navigateBack();
  await device1.clickOnByAccessibilityID('Call');
  // Enabled voice calls in privacy settings
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Settings',
  });

  // Scroll to bottom of page to voice and video calls
  await sleepFor(1000);
  await device1.scrollDown();
  const voicePermissions = await device1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'android:id/summary',
    text: 'Enables voice and video calls to and from other users.',
  });

  await device1.click(voicePermissions.ELEMENT);
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await device1.clickOnByAccessibilityID('Enable');
  // Navigate back to conversation
  await device1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
  });
  await device1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );

  await device1.clickOnByAccessibilityID('Navigate up');
  // Enable voice calls on device 2 for User B
  await device2.clickOnByAccessibilityID('Call');
  // Enabled voice calls in privacy settings
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Settings',
    text: 'Settings',
  });

  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  // Scroll to bottom of page to voice and video calls
  await sleepFor(1000);
  await device2.scrollDown();
  const voicePermissions2 = await device2.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'android:id/summary',
    text: 'Enables voice and video calls to and from other users.',
  });

  await device2.click(voicePermissions2.ELEMENT);
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await device2.clickOnByAccessibilityID('Enable');
  // Navigate back to conversation
  await device2.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
  });
  await device2.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await device2.clickOnByAccessibilityID('Navigate up');
  // Make call on device 1 (userA)
  await device1.clickOnByAccessibilityID('Call');
  // Answer call on device 2
  await device2.clickOnByAccessibilityID('Answer call');
  // Wait 5 seconds
  await sleepFor(5000);
  // Hang up
  await device1.clickOnElementById('network.loki.messenger:id/endCallButton');
  // Check for config message 'Called User B' on device 1
  await device1.waitForControlMessageToBePresent(`Called ${userB.userName}`);
  await device2.waitForControlMessageToBePresent(`${userA.userName} called you`);
  // Wait 10 seconds for control message to be deleted
  await sleepFor(10000);
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: `You called ${userB.userName}`,
    maxWait: 1000,
  });
  await device2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: `${userA.userName} called you`,
    maxWait: 1000,
  });
  await closeApp(device1, device2);
}
