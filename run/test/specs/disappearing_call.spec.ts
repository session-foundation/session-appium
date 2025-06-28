import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';
import { TestInfo } from '@playwright/test';

bothPlatformsItSeparate({
  title: 'Disappearing call message 1o1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingCallMessage1o1Ios,
    shouldSkip: true,
  },
  android: {
    testCb: disappearingCallMessage1o1Android,
    shouldSkip: true,
  },
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingCallMessage1o1Ios(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true, testInfo });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // await alice1.navigateBack();
  await alice1.clickOnByAccessibilityID('Call');
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
  await alice1.clickOnByAccessibilityID('Continue');
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
  await alice1.clickOnByAccessibilityID('Call');
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

async function disappearingCallMessage1o1Android(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true, testInfo });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);

  // await alice1.navigateBack();
  await alice1.clickOnByAccessibilityID('Call');
  // Enabled voice calls in privacy settings
  await alice1.waitForTextElementToBePresent({
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

  await alice1.navigateBack();
  // Enable voice calls on device 2 for User B
  await bob1.clickOnByAccessibilityID('Call');
  // Enabled voice calls in privacy settings
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Settings',
    text: 'Settings',
  });

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
  await bob1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
  });
  await bob1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await bob1.navigateBack();
  // Make call on device 1 (alice)
  await alice1.clickOnByAccessibilityID('Call');
  // Answer call on device 2
  await bob1.clickOnByAccessibilityID('Answer call');
  // Wait 5 seconds
  await sleepFor(5000);
  // Hang up
  await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
  // Check for config message 'Called User B' on device 1
  await alice1.waitForControlMessageToBePresent(`Called ${bob.userName}`);
  await bob1.waitForControlMessageToBePresent(`${alice.userName} called you`);
  // Wait 10 seconds for control message to be deleted
  await sleepFor(10000);
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
