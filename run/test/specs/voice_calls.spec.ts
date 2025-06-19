import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { ExitUserProfile } from './locators';
import { CallButton, NotificationSettings, NotificationSwitch } from './locators/conversation';
import { open_Alice1_bob1_notfriends } from './state_builder';
import { sleepFor } from './utils/index';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

// skipping tests because they are unreliable on virtual devices, see QA-478
bothPlatformsItSeparate({
  title: 'Voice calls',
  risk: 'high',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: voiceCallIos,
    shouldSkip: true,
  },
  android: {
    testCb: voiceCallAndroid,
    shouldSkip: true,
  },
});

async function voiceCallIos(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_bob1_notfriends({ platform });

  await alice1.sendNewMessage({ accountID: bob.sessionId }, 'Testing calls');
  // Look for phone icon (shouldnt be there)
  await alice1.hasElementBeenDeleted({ ...new CallButton(alice1).build(), maxWait: 5000 });
  // Create contact
  await bob1.clickOnByAccessibilityID('Message requests banner');
  // Select message from User A
  await bob1.clickOnByAccessibilityID('Message request');
  await bob1.onAndroid().clickOnByAccessibilityID('Accept message request');

  // Type into message input box
  await bob1.sendMessage(`Reply-message-${bob.userName}-to-${alice.userName}`);

  // Verify config message states message request was accepted
  // "messageRequestsAccepted": "Your message request has been accepted.",
  const messageRequestsAccepted = englishStrippedStr('messageRequestsAccepted').toString();
  await alice1.waitForControlMessageToBePresent(messageRequestsAccepted);
  // Phone icon should appear now that conversation has been approved
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Enabled voice calls in privacy settings
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  await alice1.clickOnByAccessibilityID('Settings');
  // Scroll to bottom of page to voice and video calls
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await alice1.modalPopup({
    strategy: 'accessibility id',
    selector: 'Allow voice and video calls',
  });
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Voice and Video Calls - Switch',
  });
  await alice1.checkModalStrings(
    englishStrippedStr('callsVoiceAndVideoBeta').toString(),
    englishStrippedStr('callsVoiceAndVideoModalDescription').toString()
  );
  await alice1.clickOnByAccessibilityID('Continue');
  // Navigate back to conversation
  await alice1.closeScreen();
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Need to allow microphone access
  await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  // Call hasn't connected until microphone access is granted
  await alice1.clickOnElementAll(new CallButton(alice1));
  await bob1.checkModalStrings(
    englishStrippedStr('callsMissedCallFrom').withArgs({ name: alice.userName }).toString(),
    englishStrippedStr('callsYouMissedCallPermissions')
      .withArgs({ name: alice.userName })
      .toString()
  );
  await bob1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Okay' });
  // Hang up on device 1
  await alice1.clickOnByAccessibilityID('End call button');
  await bob1.navigateBack();
  await bob1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: alice.userName,
  });
  await bob1.clickOnElementAll(new CallButton(bob1));
  await bob1.clickOnByAccessibilityID('Settings');
  await bob1.scrollDown();
  await bob1.modalPopup({
    strategy: 'accessibility id',
    selector: 'Allow voice and video calls',
  });
  await bob1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Voice and Video Calls - Switch',
  });
  await bob1.checkModalStrings(
    englishStrippedStr('callsVoiceAndVideoBeta').toString(),
    englishStrippedStr('callsVoiceAndVideoModalDescription').toString()
  );
  await bob1.clickOnByAccessibilityID('Continue');
  await bob1.checkModalStrings(
    englishStrippedStr('sessionNotifications').toString(),
    englishStrippedStr('callsNotificationsRequired').toString()
  );
  await sleepFor(100);
  await bob1.clickOnElementAll(new NotificationSettings(bob1));
  await bob1.clickOnElementAll({ ...new ExitUserProfile(bob1).build(), maxWait: 1000 });
  // Wait for change to take effect
  await sleepFor(1000);
  // Make call on device 1 (alice)
  await bob1.clickOnElementAll(new CallButton(bob1));
  await bob1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Wait for call to come through
  await sleepFor(1000);
  // Answer call on device 2
  await bob1.clickOnByAccessibilityID('Answer call');
  // Have to press answer twice, once in drop down and once in full screen
  await sleepFor(500);
  await bob1.clickOnByAccessibilityID('Answer call');
  // Wait 10 seconds
  await sleepFor(10000);
  // Hang up
  await alice1.clickOnByAccessibilityID('End call button');
  // Check for control messages on both devices
  // "callsYouCalled": "You called {name}",
  const callsYouCalled = englishStrippedStr('callsYouCalled')
    .withArgs({ name: bob.userName })
    .toString();
  await alice1.waitForControlMessageToBePresent(callsYouCalled);
  // "callsYouCalled": "You called {name}",
  const callsCalledYou = englishStrippedStr('callsCalledYou')
    .withArgs({ name: alice.userName })
    .toString();
  await bob1.waitForControlMessageToBePresent(callsCalledYou);
  // Excellent
  await closeApp(alice1, bob1);
}

async function voiceCallAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_bob1_notfriends({ platform });

  await alice1.sendNewMessage({ accountID: bob.sessionId }, 'Testing calls');
  // Look for phone icon (should not be there)
  await alice1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Call',
    maxWait: 5000,
  });
  // Create contact
  await bob1.clickOnByAccessibilityID('Message requests banner');
  // Select message from User A
  await bob1.clickOnByAccessibilityID('Message request');
  await bob1.clickOnByAccessibilityID('Accept message request');
  // Type into message input box
  await bob1.sendMessage(`Reply-message-${bob.userName}-to-${alice.userName}`);
  // Verify config message states message request was accepted
  await alice1.waitForControlMessageToBePresent('Your message request has been accepted.');
  // Phone icon should appear now that conversation has been approved
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Enabled voice calls in privacy settings
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  // Scroll to bottom of page to voice and video calls
  await sleepFor(1000);
  await alice1.scrollDown();
  const voicePermissions = await alice1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'android:id/summary',
    text: 'Enables voice and video calls to and from other users.',
  });

  await alice1.click(voicePermissions.ELEMENT);
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await alice1.clickOnByAccessibilityID('Enable');
  // Navigate back to conversation
  await alice1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
  });
  await alice1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await alice1.checkModalStrings(
    englishStrippedStr('sessionNotifications').toString(),
    englishStrippedStr('callsNotificationsRequired').toString(),
    true
  );
  await sleepFor(100);
  await alice1.clickOnElementAll(new NotificationSettings(alice1));
  await alice1.clickOnElementAll(new NotificationSwitch(alice1));
  await alice1.navigateBack();
  // Enable voice calls on device 2 for User B
  await bob1.clickOnElementAll(new CallButton(bob1));
  // Enabled voice calls in privacy settings
  await bob1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  // Scroll to bottom of page to voice and video calls
  await sleepFor(1000);
  await bob1.scrollDown();
  const voicePermissions2 = await bob1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'android:id/summary',
    text: 'Enables voice and video calls to and from other users.',
  });

  await bob1.click(voicePermissions2.ELEMENT);
  // Toggle voice settings on
  // Click enable on exposure IP address warning
  await bob1.clickOnByAccessibilityID('Enable');
  // Navigate back to conversation
  // TO FIX (SOMETHING WRONG WITH ANSWER CALL)
  await bob1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
  });
  await bob1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await bob1.checkModalStrings(
    englishStrippedStr('sessionNotifications').toString(),
    englishStrippedStr('callsNotificationsRequired').toString(),
    true
  );
  await sleepFor(100);
  await bob1.clickOnElementAll(new NotificationSettings(bob1));
  await bob1.clickOnElementAll(new NotificationSwitch(bob1));
  await bob1.navigateBack();
  await bob1.navigateBack();
  // Make call on device 1 (alice)
  await bob1.clickOnElementAll(new CallButton(bob1));
  // Answer call on device 2
  await bob1.clickOnElementById('network.loki.messenger:id/acceptCallButton');
  // Wait 5 seconds
  await sleepFor(5000);
  // Hang up
  await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
  // Check for config message 'Called User B' on device 1
  await alice1.waitForControlMessageToBePresent(`Called ${bob.userName}`);
  await bob1.waitForControlMessageToBePresent(`${alice.userName} called you`);
  // Excellent
  await closeApp(alice1, bob1);
}
