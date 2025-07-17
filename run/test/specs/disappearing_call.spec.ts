import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { CallButton, NotificationSettings, NotificationSwitch } from './locators/conversation';
import { ContinueButton } from './locators/global';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsItSeparate({
  title: 'Disappearing call message 1o1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingCallMessage1o1Ios,
    shouldSkip: true, // Calls are still unreliable on iOS
  },
  android: {
    testCb: disappearingCallMessage1o1Android,
    shouldSkip: false,
  },
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: `Verifies that a call control message disappears as expected in a 1:1 conversation`,
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const maxWait = 35_000; // 30s plus buffer

async function disappearingCallMessage1o1Ios(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
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
  await alice1.clickOnElementAll(new ContinueButton(alice1));
  // Navigate back to conversation
  await sleepFor(500);
  await alice1.clickOnByAccessibilityID('Close button');
  // Enable voice calls on device 2 for User B
  await bob1.clickOnByAccessibilityID('Call');
  await bob1.clickOnByAccessibilityID('Settings');
  await bob1.scrollDown();
  await bob1.modalPopup({
    strategy: 'accessibility id',
    selector: 'Allow voice and video calls',
  });
  await bob1.clickOnByAccessibilityID('Enable');
  await sleepFor(500, true);
  await bob1.clickOnByAccessibilityID('Close button');
  // Make call on device 1 (alice)
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Answer call on device 2
  await bob1.clickOnByAccessibilityID('Answer call');
  // Wait 30 seconds
  // Hang up
  await alice1.clickOnByAccessibilityID('End call button');
  // Check for config message 'Called User B' on device 1
  await alice1.waitForControlMessageToBePresent(`You called ${bob.userName}`);
  await alice1.waitForControlMessageToBePresent(`${alice.userName} called you`);
  // Wait 30 seconds for control message to be deleted
  await sleepFor(30000);
  await alice1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: `You called ${bob.userName}`,
    maxWait: 1000,
  });
  await bob1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: `${alice.userName} called you`,
    maxWait: 1000,
  });
  await closeApp(alice1, bob1);
}

async function disappearingCallMessage1o1Android(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Alice turns on all calls perms necessary (without checking every modal string)
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  await alice1.clickOnByAccessibilityID('Enable');
  await alice1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await alice1.clickOnElementAll(new NotificationSettings(alice1));
  await alice1.clickOnElementAll(new NotificationSwitch(alice1));
  // Return to conversation
  await alice1.navigateBack(false);
  await alice1.navigateBack(false);
  // Alice tries again, call is put through even though Bob has not activated their settings
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Confirm call is put through
  await alice1.doesElementExist({
    strategy: 'id',
    selector: 'network.loki.messenger:id/callTitle',
    text: 'Ringing...',
    maxWait: 5_000,
  });
  await alice1.doesElementExist({
    strategy: 'id',
    selector: 'network.loki.messenger:id/callSubtitle',
    text: 'Sending Call Offer 2/5',
    maxWait: 5_000,
  });
  await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
  // Wait for control message to disappear
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `You called ${bob.userName}`,
      maxWait,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `Missed call from ${alice.userName}`,
      maxWait,
    }),
  ]);
  await closeApp(alice1, bob1);
}
