import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsItSeparate } from '../../../types/sessionIt';
import { CloseSettings } from '../../locators';
import { CallButton, NotificationSwitch } from '../../locators/conversation';
import { SettingsModalsEnableButton } from '../../locators/settings';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { sleepFor } from '../../utils';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { CALLS_PERMISSION_CONTEXT } from '../../utils/pro_context';
import {
  getDisappearingTestTime,
  getDisappearingTestTiming,
  setDisappearingMessage,
} from '../../utils/set_disappearing_messages';

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
  allureLinks: {
    android: 'SES-5265',
  },
});

const time = getDisappearingTestTime();
const timerType = 'Disappear after send option';
const { expectedDuration, maxWait } = getDisappearingTestTiming();

// TODO: abstract call logic into utils since they're reused in multiple tests
async function disappearingCallMessage1o1Ios(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
    testContext: CALLS_PERMISSION_CONTEXT,
  });
  await setDisappearingMessage(alice1, ['1:1', timerType, time]);
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Alice turns on all calls perms necessary (without checking every modal string)
  await alice1.clickOnByAccessibilityID('Settings');
  await alice1.clickOnByAccessibilityID('Continue');
  // Need to allow microphone access
  await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  await sleepFor(1_000);
  // Need to allow camera access
  await alice1.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
  // Poll the toggle until it flips to enabled rather than a fixed 10s wait — returns as soon as
  // it's on (this auto-grant is a known-flaky Simulator behaviour).
  const aliceLocalNetworkEnabled = await alice1.waitForElementValue(
    { strategy: 'accessibility id', selector: 'Local Network Permission - Switch' },
    '1',
    10_000
  );
  if (!aliceLocalNetworkEnabled) {
    throw new Error(
      `Local Network Permission was not enabled automatically.
      This is a known Simulator bug that fails randomly with no pattern or fix.
      Retrying won't help - use a real device where you can manually enable the permission.`
    );
  }
  await alice1.clickOnElementAll(new CloseSettings(alice1));
  // Alice tries again, call is put through even though Bob has not activated their settings
  // Stamped when the call is PLACED, not when it is ended: the control message is created here, so its
  // disappearing timer starts here too. `hasElementDisappeared` rejects a lifetime under 0.8x the timer
  // as a product bug, and anchoring on the end charges the call's own duration to that lifetime.
  const callPlacedTimestamp = Date.now();
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
      expectedDuration,
      actualStartTime: callPlacedTimestamp,
    }),
    bob1.hasElementDisappeared({
      strategy: 'accessibility id',
      selector: 'Control message',
      text: callsMissedCallFrom,
      maxWait,
      expectedDuration,
      actualStartTime: callPlacedTimestamp,
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
    testContext: CALLS_PERMISSION_CONTEXT,
  });
  await setDisappearingMessage(alice1, ['1:1', timerType, time]);
  await alice1.clickOnElementAll(new CallButton(alice1));
  // Alice turns on all calls perms necessary (without checking every modal string)
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Settings',
  });
  await alice1.clickOnElementAll(new SettingsModalsEnableButton(alice1));
  await alice1.clickOnElementById(
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  );
  await alice1.clickOnElementAll(new SettingsModalsEnableButton(alice1));
  await alice1.clickOnElementAll(new NotificationSwitch(alice1));
  // Return to conversation
  await alice1.navigateBack(false);
  await alice1.navigateBack(false);
  // Alice tries again, call is put through even though Bob has not activated their settings
  // Stamped when the call is PLACED, not when it is ended: the control message is created here, so its
  // disappearing timer starts here too. `hasElementDisappeared` rejects a lifetime under 0.8x the timer
  // as a product bug, and anchoring on the end charges the call's own duration to that lifetime —
  // measured at 7.9s against a 10s timer on one run and passing on the next, entirely on how long the
  // two waits below took.
  const callPlacedTimestamp = Date.now();
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
  // Wait for control message to disappear
  await Promise.all([
    alice1.hasElementDisappeared({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `You called ${bob.userName}`,
      maxWait,
      expectedDuration,
      actualStartTime: callPlacedTimestamp,
    }),
    bob1.hasElementDisappeared({
      strategy: 'id',
      selector: 'network.loki.messenger:id/call_text_view',
      text: `Missed call from ${alice.userName}`,
      maxWait,
      expectedDuration,
      actualStartTime: callPlacedTimestamp,
    }),
  ]);
  await closeApp(alice1, bob1);
}
