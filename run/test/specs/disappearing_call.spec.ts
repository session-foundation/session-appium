import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { CloseSettings } from './locators';
import { CallButton, NotificationsModalButton, NotificationSwitch } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsItSeparate({
  title: 'Disappearing call message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingCallMessage1o1Ios,
  },
  android: {
    testCb: disappearingCallMessage1o1Android,
  },
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription:
    'Verifies that a call control message disappears as expected in a 1:1 conversation',
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const maxWait = 35_000; // 30s plus buffer

// TODO: abstract call logic into utils since they're reused in multiple tests
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
  // Alice turns on all calls perms necessary (without checking every modal string)
  await alice1.clickOnByAccessibilityID('Settings');
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
  await alice1.clickOnElementAll(new CloseSettings(alice1));
  // Alice tries again, call is put through even though Bob has not activated their settings
  let callEndTimestamp!: number;
  await alice1.clickOnElementAll(new CallButton(alice1));
  await Promise.all([
    (async () => {
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
      callEndTimestamp = Date.now();
    })(),
    (async () => {
      await bob1.clickOnByAccessibilityID('Settings');
      await bob1.clickOnByAccessibilityID('Cancel');
      await bob1.clickOnElementAll(new CloseSettings(bob1));
    })(),
  ]);
  const callsYouCalled = tStripped('callsYouCalled', { name: bob.userName });
  const callsMissedCallFrom = tStripped('callsMissedCallFrom', { name: alice.userName });
  await Promise.all([
    alice1.hasElementDisappeared({
      strategy: 'accessibility id',
      selector: 'Control message',
      text: callsYouCalled,
      maxWait,
      actualStartTime: callEndTimestamp,
    }),
    bob1.hasElementDisappeared({
      strategy: 'accessibility id',
      selector: 'Control message',
      text: callsMissedCallFrom,
      maxWait,
      actualStartTime: callEndTimestamp,
    }),
  ]);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}

async function disappearingCallMessage1o1Android(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
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
  await alice1.clickOnElementAll(new NotificationsModalButton(alice1));
  await alice1.clickOnElementAll(new NotificationSwitch(alice1));
  // Return to conversation
  await alice1.navigateBack(false);
  await alice1.navigateBack(false);
  // Alice tries again, call is put through even though Bob has not activated their settings
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Confirm call is put through
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
  await alice1.clickOnElementById('network.loki.messenger:id/endCallButton');
  const callEndTimestamp = Date.now();
  // Wait for control message to disappear
  await Promise.all([
    alice1.hasElementDisappeared({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `You called ${bob.userName}`,
      maxWait,
      actualStartTime: callEndTimestamp,
    }),
    bob1.hasElementDisappeared({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `Missed call from ${alice.userName}`,
      maxWait,
      actualStartTime: callEndTimestamp,
    }),
  ]);
  await closeApp(alice1, bob1);
}
