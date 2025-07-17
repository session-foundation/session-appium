import { test, type TestInfo } from '@playwright/test';

import { testLink } from '../../constants';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { LinkPreviewMessage } from './locators';
import { MessageInput, OutgoingMessageStatusSent } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing link to group',
  risk: 'low',
  testCb: disappearingLinkMessageGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: `Verifies that a GIF disappears as expected in a group conversation`,
});
const timerType = 'Disappear after send option';
const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const maxWait = 31_000; // 30s plus buffer

async function disappearingLinkMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Testing disappearing messages';
  const {
    devices: { alice1, bob1, charlie1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo,
    });
  });
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET_DISAPPEARING_MSG, async () => {
    await setDisappearingMessage(platform, alice1, ['Group', timerType, time]);
  });
  await test.step(TestSteps.SEND.LINK, async () => {
    await alice1.inputText(testLink, new MessageInput(alice1));
    // Enable link preview modal appears as soon as link is typed on android but on iOS it appears after
    await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('linkPreviewsEnable').toString(),
        englishStrippedStr('linkPreviewsFirstDescription').toString(),
        false
      );
    });
    // Accept link preview modal
    await alice1.clickOnByAccessibilityID('Enable');
    // On iOS, Appium types so the link preview modal interrupts typing the link, must be deleted and typed again
    await alice1.onIOS().deleteText(new MessageInput(alice1));
    await alice1.onIOS().inputText(testLink, new MessageInput(alice1));
    // Let preview load
    await sleepFor(5000);
    await alice1.clickOnByAccessibilityID('Send message button');
    await alice1.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(alice1).build(),
      maxWait: 20000,
    });
  });
  // Wait for 30 seconds to disappear
  await test.step(TestSteps.VERIFY.MESSAGE_DISAPPEARED, async () => {
    if (platform === 'ios') {
      await Promise.all(
        [alice1, bob1, charlie1].map(device =>
          device.hasElementBeenDeleted({
            strategy: 'accessibility id',
            selector: 'Message body',
            maxWait,
            text: testLink,
          })
        )
      );
    }
    if (platform === 'android') {
      await Promise.all(
        [alice1, bob1, charlie1].map(device =>
          device.hasElementBeenDeleted({
            ...new LinkPreviewMessage(device).build(),
            maxWait,
          })
        )
      );
    }
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
