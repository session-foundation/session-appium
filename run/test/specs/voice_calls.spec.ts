import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { CloseSettings } from './locators';
import { CallButton, NotificationsModalButton, NotificationSwitch } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils/index';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Voice calls',
  risk: 'high',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: voiceCallIos,
  },
  android: {
    testCb: voiceCallAndroid,
  },
  allureSuites: {
    parent: 'Voice Calls',
  },
  allureDescription: `Verifies voice call functionality and permission flow:
    - Verifies strings of all call permission prompts (microphone, notifications, etc.)
    - Verifies missed call notifications when recipient lacks permissions
    - Confirms successful call connection once both users enable permissions
    - Verifies control messages after call is finished
    Note that due to the nature of virtual devices, no actual "talking" takes place`,
});

async function voiceCallIos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: true,
      testInfo,
    });
  });
  await test.step(TestSteps.CALLS.INITIATE_CALL(alice.userName), async () => {
    await alice1.clickOnElementAll(new CallButton(alice1));
  });
  await test.step(TestSteps.CALLS.ACCEPT_PERMS(alice.userName), async () => {
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('enable calls permission'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('callsPermissionsRequired').toString(),
        englishStrippedStr('callsPermissionsRequiredDescription').toString()
      );
    });
    await alice1.clickOnByAccessibilityID('Settings');
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('beta calls'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('callsVoiceAndVideoBeta').toString(),
        englishStrippedStr('callsVoiceAndVideoModalDescription').toString()
      );
    });
    await alice1.clickOnByAccessibilityID('Continue');
    // Need to allow microphone access
    await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
    await sleepFor(1_000);
    // Need to allow camera access
    await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
    await sleepFor(10_000); // Wait a bit for the toggles to turn to TRUE
    const aliceLocalNetworkSwitch = await alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Local Network Permission - Switch',
    });
    const aliceAttr = await alice1.getAttribute('value', aliceLocalNetworkSwitch.ELEMENT);
    if (aliceAttr !== '1') {
      throw new Error(
        `Local Network Permission was not enabled automatically.
      This is a known Simulator bug that fails randomly with no pattern or fix.
      Retrying won't help - use a real device where you can manually enable the permission.`
      );
    }
  });
  await alice1.clickOnElementAll(new CloseSettings(alice1));
  // Alice tries again, call is created but Bob still hasn't enabled their calls perms so this will fail
  await test.step(TestSteps.CALLS.INITIATE_CALL(alice.userName), async () => {
    await alice1.clickOnElementAll(new CallButton(alice1));
    await bob1.checkModalStrings(
      englishStrippedStr('callsMissedCallFrom').withArgs({ name: alice.userName }).toString(),
      englishStrippedStr('callsYouMissedCallPermissions')
        .withArgs({ name: alice.userName })
        .toString()
    );
    await bob1.clickOnByAccessibilityID('Settings');
    await alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Ringing...',
      maxWait: 5_000,
    });
    await alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Awaiting Recipient Answer... 4/6',
      maxWait: 5_000,
    });
    await alice1.clickOnByAccessibilityID('End call button');
  });
  await bob1.checkModalStrings(
    englishStrippedStr('callsVoiceAndVideoBeta').toString(),
    englishStrippedStr('callsVoiceAndVideoModalDescription').toString()
  );
  await bob1.clickOnByAccessibilityID('Continue');
  // Need to allow microphone access
  await bob1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  await sleepFor(1_000);
  // Need to allow camera access
  await bob1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  await sleepFor(10_000); // Wait a bit for the toggles to turn to TRUE
  const bobLocalNetworkSwitch = await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Local Network Permission - Switch',
  });
  const bobAttr = await bob1.getAttribute('value', bobLocalNetworkSwitch.ELEMENT);
  if (bobAttr !== '1') {
    throw new Error(
      `Local Network Permission was not enabled automatically.
      This is a known Simulator bug that fails randomly with no pattern or fix.
      Retrying won't help - use a real device where you can manually enable the permission.`
    );
  }
  await bob1.clickOnElementAll(new CloseSettings(bob1));
  await alice1.clickOnElementAll(new CallButton(alice1));
  await bob1.clickOnByAccessibilityID('Answer call');
  await Promise.all(
    [alice1, bob1].map(device =>
      // If a text on screen contains the 00: assume it's the call duration (ergo the call connected)
      // A simple : didn't work, that picked up other elements in the conversation
      device.waitForTextElementToBePresent({
        strategy: 'xpath',
        selector: `//XCUIElementTypeStaticText[contains(@name, '00:')]`,
        maxWait: 15_000,
      })
    )
  );
  await alice1.clickOnByAccessibilityID('End call button');
  // Check for control messages on both devices
  const callsYouCalled = englishStrippedStr('callsYouCalled')
    .withArgs({ name: bob.userName })
    .toString();
  await alice1.waitForControlMessageToBePresent(callsYouCalled);
  const callsCalledYou = englishStrippedStr('callsCalledYou')
    .withArgs({ name: alice.userName })
    .toString();
  await bob1.waitForControlMessageToBePresent(callsCalledYou);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}

async function voiceCallAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: true,
      testInfo,
    });
  });
  await test.step(TestSteps.CALLS.INITIATE_CALL(alice.userName), async () => {
    await alice1.clickOnElementAll(new CallButton(alice1));
  });
  await test.step(TestSteps.CALLS.ACCEPT_PERMS(alice.userName), async () => {
    // Alice turns on all calls perms necessary
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('enable calls permission'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('callsPermissionsRequired').toString(),
        englishStrippedStr('callsPermissionsRequiredDescription').toString()
      );
      await alice1.clickOnElementAll({
        strategy: 'accessibility id',
        selector: 'Settings',
      });
    });
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('beta calls'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('callsVoiceAndVideoBeta').toString(),
        englishStrippedStr('callsVoiceAndVideoModalDescription').toString()
      );
      await alice1.clickOnByAccessibilityID('Enable');
    });
    await alice1.clickOnElementById(
      'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
    );
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('notifications permission'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('sessionNotifications').toString(),
        englishStrippedStr('callsNotificationsRequired').toString()
      );
      await alice1.clickOnElementAll(new NotificationsModalButton(alice1));
      await alice1.clickOnElementAll(new NotificationSwitch(alice1));
    });
    await alice1.navigateBack(false);
    await alice1.navigateBack(false);
  });
  // Alice tries again, call is created but Bob still hasn't enabled their calls perms so this will fail
  await test.step(TestSteps.CALLS.INITIATE_CALL(alice.userName), async () => {
    await alice1.clickOnElementAll(new CallButton(alice1));
    await test.step(TestSteps.VERIFY.CALLING, async () => {
      await alice1.waitForTextElementToBePresent({
        strategy: 'id',
        selector: 'network.loki.messenger:id/callTitle',
        text: 'Ringing...',
        maxWait: 5_000,
      });
      await alice1.waitForTextElementToBePresent({
        strategy: 'id',
        selector: 'network.loki.messenger:id/callSubtitle',
        text: 'Sending Call Offer 2/5',
        maxWait: 5_000,
      });
    });
    await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
  });
  // Bob sees the missed call and also jumps through all the hoops
  await test.step(TestSteps.VERIFY.MISSED_CALL, async () => {
    await bob1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `Missed call from ${alice.userName}`,
    });
    await bob1.clickOnElementAll({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `Missed call from ${alice.userName}`,
    });
  });
  await test.step(TestSteps.CALLS.ACCEPT_PERMS(bob.userName), async () => {
    await bob1.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Settings',
    });
    await bob1.clickOnByAccessibilityID('Enable');
    await bob1.clickOnElementById(
      'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
    );
    await bob1.clickOnElementAll(new NotificationsModalButton(bob1));
    await bob1.clickOnElementAll(new NotificationSwitch(bob1));
    await bob1.navigateBack(false);
    await bob1.navigateBack(false);
  });
  // A call is finally placed, picked up, and ended
  await test.step(TestSteps.CALLS.INITIATE_CALL(bob.userName), async () => {
    await bob1.clickOnElementAll(new CallButton(bob1));
  });
  await alice1.clickOnElementById('network.loki.messenger:id/callInProgress');
  await alice1.clickOnElementById('network.loki.messenger:id/acceptCallButton');
  await test.step(TestSteps.VERIFY.CALL_SUCCESSFUL, async () => {
    await Promise.all(
      [alice1, bob1].map(device =>
        // If the text contains a colon it means its showing the call duration (ergo the call connected)
        device.waitForTextElementToBePresent({
          strategy: 'xpath',
          selector: `//*[@resource-id='network.loki.messenger:id/callTitle' and contains(@text, ':')]`,
          maxWait: 15_000,
        })
      )
    );
    await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
    await Promise.all([
      alice1.waitForTextElementToBePresent({
        strategy: 'id',
        selector: 'network.loki.messenger:id/call_text_view',
        text: `${bob.userName} called you`,
        maxWait: 15_000,
      }),
      bob1.waitForTextElementToBePresent({
        strategy: 'id',
        selector: 'network.loki.messenger:id/call_text_view',
        text: `You called ${alice.userName}`,
        maxWait: 15_000,
      }),
    ]);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
