import { englishStripped } from '../../localizer/i18n/localizedString';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ExitUserProfile } from './locators';
import { newUser } from './utils/create_account';
import { sleepFor } from './utils/index';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

androidIt('Voice calls', 'high', voiceCallAndroid);
iosIt('Voice calls', 'high', voiceCallIos);

async function voiceCallIos(platform: SupportedPlatformsType) {
  // Open app
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and User B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  await device1.sendNewMessage(userB, 'Testing calls');
  // Look for phone icon (shouldnt be there)
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Call',
  });
  // Create contact
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Select message from User A
  await device2.clickOnByAccessibilityID('Message request');
  await device2.onAndroid().clickOnByAccessibilityID('Accept message request');

  // Type into message input box
  await device2.sendMessage(`Reply-message-${userB.userName}-to-${userA.userName}`);

  // Verify config message states message request was accepted
  // "messageRequestsAccepted": "Your message request has been accepted.",
  const messageRequestsAccepted = englishStripped('messageRequestsAccepted').toString();
  await device1.waitForControlMessageToBePresent(messageRequestsAccepted);
  await device1.waitForControlMessageToBePresent('Your message request has been accepted.');
  // Phone icon should appear now that conversation has been approved
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
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Voice and Video Calls - Switch',
  });
  await device1.checkModalStrings(
    englishStripped('callsVoiceAndVideoBeta').toString(),
    englishStripped('callsVoiceAndVideoModalDescription').toString()
  );
  await device1.clickOnByAccessibilityID('Continue');
  // Navigate back to conversation
  await device1.clickOnElementAll(new ExitUserProfile(device1));
  await device1.clickOnByAccessibilityID('Call');
  // Need to allow microphone access
  await device1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  // Call hasn't connected until microphone access is granted
  await device1.clickOnByAccessibilityID('Call');
  // Enable voice calls on device 2 for User B
  // Need to navigate out of conversation for user to have full contact actions (calls icon, etc)
  // await device2.checkModalStrings(
  //   englishStripped('callsMissedCallFrom').withArgs({ name: userA.userName }).toString(),
  //   englishStripped('callsYouMissedCallPermissions').withArgs({ name: userA.userName }).toString()
  // );
  await device2.clickOnElementAll({ strategy: 'accessibility id', selector: 'Okay' });
  // Hang up on device 1
  await device1.clickOnByAccessibilityID('End call button');
  await device2.navigateBack();
  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: userA.userName,
  });
  await device2.clickOnByAccessibilityID('Call');
  await device2.clickOnByAccessibilityID('Settings');
  await device2.scrollDown();
  await device2.modalPopup({
    strategy: 'accessibility id',
    selector: 'Allow voice and video calls',
  });
  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Voice and Video Calls - Switch',
  });
  await device2.checkModalStrings(
    englishStripped('callsVoiceAndVideoBeta').toString(),
    englishStripped('callsVoiceAndVideoModalDescription').toString()
  );
  await device2.clickOnByAccessibilityID('Continue');
  await device2.clickOnElementAll(new ExitUserProfile(device2));
  // Make call on device 1 (userA)
  await device1.clickOnByAccessibilityID('Call');
  // await device1.clickOnByAccessibilityID("OK");
  await device1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  await device1.clickOnByAccessibilityID('Call');
  // Wait for call to come through
  // await sleepFor(1000);
  // Answer call on device 2
  await device2.clickOnByAccessibilityID('Answer call');
  // Have to press answer twice, once in drop down and once in full screen
  await sleepFor(500);
  await device2.clickOnByAccessibilityID('Answer call');
  // Wait 10 seconds
  // Hang up
  await device1.clickOnByAccessibilityID('End call button');
  // Check for control messages on both devices
  // "callsYouCalled": "You called {name}",
  const callsYouCalled = englishStripped('callsYouCalled')
    .withArgs({ name: userB.userName })
    .toString();
  await device1.waitForControlMessageToBePresent(callsYouCalled);
  // "callsYouCalled": "You called {name}",
  const callsCalledYou = englishStripped('callsCalledYou')
    .withArgs({ name: userB.userName })
    .toString();
  await device2.waitForControlMessageToBePresent(callsCalledYou);
  // Excellent
  await closeApp(device1, device2);
}

async function voiceCallAndroid(platform: SupportedPlatformsType) {
  // Open app
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and User B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  await device1.sendNewMessage(userB, 'Testing calls');
  // Look for phone icon (shouldnt be there)
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Call',
  });
  // Create contact
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Select message from User A
  await device2.clickOnByAccessibilityID('Message request');
  await device2.clickOnByAccessibilityID('Accept message request');
  // Type into message input box
  await device2.sendMessage(`Reply-message-${userB.userName}-to-${userA.userName}`);
  // Verify config message states message request was accepted
  await device1.waitForControlMessageToBePresent('Your message request has been accepted.');
  // Phone icon should appear now that conversation has been approved
  await device1.clickOnByAccessibilityID('Call');
  // Enabled voice calls in privacy settings
  await device1.clickOnElementAll({
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

  await device1.navigateBack();
  // Enable voice calls on device 2 for User B
  await device2.clickOnByAccessibilityID('Call');
  // Enabled voice calls in privacy settings
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
  // TO FIX (SOMETHING WRONG WITH ANSWER CALL)
  await device2.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
  });
  await device2.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await device2.navigateBack();
  // Make call on device 1 (userA)
  await device1.clickOnByAccessibilityID('Call');
  // Answer call on device 2
  await device2.clickOnElementById('network.loki.messenger:id/acceptCallButton');
  // Wait 5 seconds
  await sleepFor(5000);
  // Hang up
  await device1.clickOnElementById('network.loki.messenger:id/endCallButton');
  // Check for config message 'Called User B' on device 1
  await device1.waitForControlMessageToBePresent(`Called ${userB.userName}`);
  await device2.waitForControlMessageToBePresent(`${userA.userName} called you`);
  // Excellent
  await closeApp(device1, device2);
}
