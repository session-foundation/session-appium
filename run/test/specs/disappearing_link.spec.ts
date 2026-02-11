import { test, type TestInfo } from '@playwright/test';

import { testLink } from '../../constants';
import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { LinkPreview, LinkPreviewMessage } from './locators';
import {
  MessageBody,
  MessageInput,
  OutgoingMessageStatusSent,
  SendButton,
} from './locators/conversation';
import { EnableLinkPreviewsModalButton } from './locators/global';
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
  allureDescription: 'Verifies that a link preview disappears as expected in a 1:1 conversation',
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after read option';
const maxWait = 35_000; // 30s plus buffer
let sentTimestamp: number;

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
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET(time), async () => {
    await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  });
  await test.step(TestSteps.SEND.LINK, async () => {
    await alice1.inputText(testLink, new MessageInput(alice1));
    // Accept dialog for link preview
    await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
      await alice1.checkModalStrings(
        tStripped('linkPreviewsEnable'),
        tStripped('linkPreviewsFirstDescription')
      );
    });
    await alice1.clickOnElementAll(new EnableLinkPreviewsModalButton(alice1));
    // On iOS, Appium doesn't paste but type, and the link preview modal interrupts typing the link, the text must be deleted and typed again
    await alice1.deleteText(new MessageInput(alice1));
    await alice1.inputText(testLink, new MessageInput(alice1));
    await alice1.waitForTextElementToBePresent(new LinkPreview(alice1));
    await alice1.clickOnElementAll(new SendButton(alice1));
    await alice1.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(alice1).build(),
      maxWait: 20000,
    });
    sentTimestamp = Date.now();
  });
  // Wait for 30 seconds to disappear
  await test.step(TestSteps.VERIFY.MESSAGE_DISAPPEARED, async () => {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementDisappeared({
          ...new MessageBody(device, testLink).build(),
          maxWait,
          actualStartTime: sentTimestamp,
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
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET(time), async () => {
    await setDisappearingMessage(platform, alice1, ['1:1', timerType, time]);
  });
  await test.step(TestSteps.SEND.LINK, async () => {
    await alice1.inputText(testLink, new MessageInput(alice1));
    // Accept dialog for link preview
    await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
      await alice1.checkModalStrings(
        tStripped('linkPreviewsEnable'),
        tStripped('linkPreviewsFirstDescription')
      );
    });
    await alice1.clickOnElementAll(new EnableLinkPreviewsModalButton(alice1));
    // Preview takes a while to load
    await sleepFor(5000);
    await alice1.clickOnElementAll(new SendButton(alice1));
    await alice1.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(alice1).build(),
      maxWait: 20000,
    });
    sentTimestamp = Date.now();
  });
  await test.step(TestSteps.VERIFY.MESSAGE_DISAPPEARED, async () => {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementDisappeared({
          ...new LinkPreviewMessage(device).build(),
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
