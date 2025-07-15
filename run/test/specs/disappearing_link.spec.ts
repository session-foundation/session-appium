import { test, type TestInfo } from '@playwright/test';

import { testLink } from '../../constants';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { LinkPreview, LinkPreviewMessage } from './locators';
import { MessageInput, OutgoingMessageStatusSent } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsItSeparate({
  title: 'Disappearing link message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingLinkMessage1o1Ios,
  },
  android: {
    testCb: disappearingLinkMessage1o1Android,
  },
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription:
    'Verifies that link previews in 1:1s disappear after the configured expiration time',
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after read option';

async function disappearingLinkMessage1o1Ios(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: true,
      testInfo,
    });
  });
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET_DISAPPEARING_MSG, async () => {
    await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  });
  await test.step(TestSteps.SEND.LINK, async () => {
    await alice1.inputText(testLink, new MessageInput(alice1));
    // Accept dialog for link preview
    await test.step(TestSteps.VERIFY.MODAL_STRINGS, async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('linkPreviewsEnable').toString(),
        englishStrippedStr('linkPreviewsFirstDescription').toString()
      );
    });
    await alice1.clickOnByAccessibilityID('Enable');
    // On iOS, Appium types so the link preview modal interrupts typing the link, must be deleted and typed again
    await alice1.deleteText(new MessageInput(alice1));
    await alice1.inputText(testLink, new MessageInput(alice1));
    await alice1.waitForTextElementToBePresent(new LinkPreview(alice1));

    await alice1.clickOnByAccessibilityID('Send message button');
    await alice1.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(alice1).build(),
      maxWait: 20000,
    });
  });
  await test.step(TestSteps.VERIFY.MESSAGE_RECEIVED, async () => {
    // Make sure image preview is available in device 2
    await bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testLink,
    });
  });
  // Wait for 30 seconds to disappear
  await test.step(TestSteps.VERIFY.MESSAGE_DISAPPEARED, async () => {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          maxWait: 30000,
          text: testLink,
        })
      )
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}

async function disappearingLinkMessage1o1Android(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const {
    devices: { alice1, bob1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: true,
      testInfo,
    });
  });
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET_DISAPPEARING_MSG, async () => {
    await setDisappearingMessage(platform, alice1, ['1:1', timerType, time]);
  });
  await test.step(TestSteps.SEND.LINK, async () => {
    await alice1.inputText(testLink, new MessageInput(alice1));
    // Accept dialog for link preview
    await test.step(TestSteps.VERIFY.MODAL_STRINGS, async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('linkPreviewsEnable').toString(),
        englishStrippedStr('linkPreviewsFirstDescription').toString(),
        false
      );
    });
    await alice1.clickOnByAccessibilityID('Enable');
    // Preview takes a while to load
    await sleepFor(5000);
    await alice1.clickOnByAccessibilityID('Send message button');
    await alice1.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(alice1).build(),
      maxWait: 20000,
    });
  });
  await test.step(TestSteps.VERIFY.MESSAGE_RECEIVED, async () => {
    // Make sure image preview is available in device 2
    await bob1.waitForTextElementToBePresent(new LinkPreviewMessage(bob1));
  });
  // Wait for 30 seconds to disappear
  await test.step(TestSteps.VERIFY.MESSAGE_DISAPPEARED, async () => {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementBeenDeleted({ ...new LinkPreviewMessage(device).build(), maxWait: 30000 })
      )
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
