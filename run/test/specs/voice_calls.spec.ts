import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
// import { ExitUserProfile } from './locators';
import { CallButton, NotificationSettings, NotificationSwitch } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils/index';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

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
    shouldSkip: false,
  },
  allureSuites: {
    parent: 'Voice Calls'
  },
  allureDescription: 
    `Verifies voice call functionality and permission flow on Android:
    - Verifies strings of all call permission prompts (microphone, notifications, etc.)
    - Verifies missed call notifications when recipient lacks permissions
    - Confirms successful call connection once both users enable permissions
    - Verifies control messages after call is finished

    Note that due to the nature of virtual devices, no actual "talking" takes place`,
});
// FIXME might need to manipulate host perms to have local network access always on 
async function voiceCallIos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    // prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({ platform, testInfo, focusFriendsConvo: true });
  await alice1.clickOnElementAll(new CallButton(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('callsPermissionsRequired').toString(),
    englishStrippedStr('callsPermissionsRequiredDescription').toString(),
  );
  await alice1.clickOnByAccessibilityID('Settings');
  await alice1.checkModalStrings(
    englishStrippedStr('callsVoiceAndVideoBeta').toString(),
    englishStrippedStr('callsVoiceAndVideoModalDescription').toString(),
  );
  await alice1.clickOnByAccessibilityID('Continue');
  // Need to allow microphone access
  await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  await sleepFor(1000);
    // Need to allow camera access
  await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  await sleepFor(5000); // Wait a bit for the toggles to turn to TRUE 
  const localNetworkSwitch = await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Local Network Permission - Switch',
  });
  const attr = await alice1.getAttribute('value', localNetworkSwitch.ELEMENT);
  if (attr !== '1') {
    alice1.log('Local Network permission must be granted but normally it is auto-granted');
    await alice1.clickOnElementAll({
      strategy: 'accessibility id', 
      selector: 'Local Network Permission - Switch'
    })
  }
  await alice1.closeScreen();
  // Alice tries again, call is created but Bob still hasn't enabled their calls perms so this will fail
  await alice1.clickOnElementAll(new CallButton(alice1));
  // The Missed call modal is currently not exposed so the test just dismisses with a button press, see SES-4192   
  await bob1.clickOnElementXPath(`//XCUIElementTypeButton[@name="Settings"]`)
  await alice1.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Ringing...',
    maxWait: 5000,
  });
  await alice1.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Awaiting Recipient Answer... 4/6',
    maxWait: 5000,
  });
  await alice1.clickOnByAccessibilityID('End call button');

  // // Navigate back to conversation
  // await alice1.closeScreen();
  // await alice1.clickOnElementAll(new CallButton(alice1));
  // // Need to allow microphone access
  // await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  // // Call hasn't connected until microphone access is granted
  // await alice1.clickOnElementAll(new CallButton(alice1));
  // await bob1.checkModalStrings(
  //   englishStrippedStr('callsMissedCallFrom').withArgs({ name: alice.userName }).toString(),
  //   englishStrippedStr('callsYouMissedCallPermissions')
  //     .withArgs({ name: alice.userName })
  //     .toString()
  // );
  // await bob1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Okay' });
  // // Hang up on device 1
  // await alice1.clickOnByAccessibilityID('End call button');
  // await bob1.navigateBack();
  // await bob1.clickOnElementAll({
  //   strategy: 'accessibility id',
  //   selector: 'Conversation list item',
  //   text: alice.userName,
  // });
  // await bob1.clickOnElementAll(new CallButton(bob1));
  // await bob1.clickOnByAccessibilityID('Settings');
  // await bob1.scrollDown();
  // await bob1.modalPopup({
  //   strategy: 'accessibility id',
  //   selector: 'Allow voice and video calls',
  // });
  // await bob1.clickOnElementAll({
  //   strategy: 'accessibility id',
  //   selector: 'Voice and Video Calls - Switch',
  // });
  // await bob1.checkModalStrings(
  //   englishStrippedStr('callsVoiceAndVideoBeta').toString(),
  //   englishStrippedStr('callsVoiceAndVideoModalDescription').toString()
  // );
  // await bob1.clickOnByAccessibilityID('Continue');
  // await bob1.checkModalStrings(
  //   englishStrippedStr('sessionNotifications').toString(),
  //   englishStrippedStr('callsNotificationsRequired').toString()
  // );
  // await sleepFor(100);
  // await bob1.clickOnElementAll(new NotificationSettings(bob1));
  // await bob1.clickOnElementAll({ ...new ExitUserProfile(bob1).build(), maxWait: 1000 });
  // // Wait for change to take effect
  // await sleepFor(1000);
  // // Make call on device 1 (alice)
  // await bob1.clickOnElementAll(new CallButton(bob1));
  // await bob1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  // await alice1.clickOnElementAll(new CallButton(alice1));
  // // Wait for call to come through
  // await sleepFor(1000);
  // // Answer call on device 2
  // await bob1.clickOnByAccessibilityID('Answer call');
  // // Have to press answer twice, once in drop down and once in full screen
  // await sleepFor(500);
  // await bob1.clickOnByAccessibilityID('Answer call');
  // // Wait 10 seconds
  // await sleepFor(10000);
  // // Hang up
  // await alice1.clickOnByAccessibilityID('End call button');
  // // Check for control messages on both devices
  // // "callsYouCalled": "You called {name}",
  // const callsYouCalled = englishStrippedStr('callsYouCalled')
  //   .withArgs({ name: bob.userName })
  //   .toString();
  // await alice1.waitForControlMessageToBePresent(callsYouCalled);
  // // "callsYouCalled": "You called {name}",
  // const callsCalledYou = englishStrippedStr('callsCalledYou')
  //   .withArgs({ name: alice.userName })
  //   .toString();
  // await bob1.waitForControlMessageToBePresent(callsCalledYou);
  // // Excellent
  // await closeApp(alice1, bob1);
}

async function voiceCallAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Restore pre-seeded accounts
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({ platform, testInfo, focusFriendsConvo: true });
  // Alice calls bob even though she doesn't have calls perms
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Alice turns on all calls perms necessary
  await alice1.checkModalStrings(
    englishStrippedStr('callsPermissionsRequired').toString(),
    englishStrippedStr('callsPermissionsRequiredDescription').toString(),
    false
  );
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  await alice1.checkModalStrings(
    englishStrippedStr('callsVoiceAndVideoBeta').toString(),
    englishStrippedStr('callsVoiceAndVideoModalDescription').toString(),
    false
  );
  await alice1.clickOnByAccessibilityID('Enable');
  await alice1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await alice1.checkModalStrings(
    englishStrippedStr('sessionNotifications').toString(),
    englishStrippedStr('callsNotificationsRequired').toString(),
    false
  );
  await alice1.clickOnElementAll(new NotificationSettings(alice1));
  await alice1.clickOnElementAll(new NotificationSwitch(alice1));
  await alice1.navigateBack(false);
  await alice1.navigateBack(false);
  // Alice tries again, call is created but Bob still hasn't enabled their calls perms so this will fail
  await alice1.clickOnElementAll(new CallButton(alice1));
  await alice1.doesElementExist({
    strategy: 'id',
    selector: 'network.loki.messenger:id/callTitle',
    text: 'Ringing...',
    maxWait: 5000,
  });
  await alice1.doesElementExist({
    strategy: 'id',
    selector: 'network.loki.messenger:id/callSubtitle',
    text: 'Sending Call Offer 2/5',
    maxWait: 5000,
  });
  await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
  // Bob sees the missed call and also jumps through all the hoops
  await bob1.doesElementExist({
    strategy: 'id',
    selector: 'network.loki.messenger:id/call_text_view',
    text: `Missed call from ${alice.userName}`,
  });
  await bob1.clickOnElementAll({
    strategy: 'id',
    selector: 'network.loki.messenger:id/call_text_view',
    text: `Missed call from ${alice.userName}`,
  });
  await bob1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  await bob1.clickOnByAccessibilityID('Enable');
  await bob1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await bob1.clickOnElementAll(new NotificationSettings(bob1));
  await bob1.clickOnElementAll(new NotificationSwitch(bob1));
  await bob1.navigateBack(false);
  await bob1.navigateBack(false);
  // A call is finally placed, picked up, and ended
  await bob1.clickOnElementAll(new CallButton(bob1));
  await alice1.clickOnElementById('network.loki.messenger:id/callInProgress');
  await alice1.clickOnElementById('network.loki.messenger:id/acceptCallButton');
  await Promise.all(
    [alice1, bob1].map(device =>
      // If the text contains a colon it means its showing the call duration (ergo the call connected)
      device.doesElementExist({
        strategy: 'xpath',
        selector: `//*[@resource-id='network.loki.messenger:id/callTitle' and contains(@text, ':')]`,
        maxWait: 15000,
      })
    )
  );
  await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
  await Promise.all([
    alice1.doesElementExist({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `${bob.userName} called you`,
      maxWait: 15000,
    }),
    bob1.doesElementExist({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `You called ${alice.userName}`,
      maxWait: 15000,
    }),
  ]);
  // Excellent
  await closeApp(alice1, bob1);
}
