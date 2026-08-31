import { test, type TestInfo } from '@playwright/test';

import { testLink } from '../../../constants';
import { tStripped } from '../../../localizer/lib';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { LinkPreview, LinkPreviewMessage } from '../../locators';
import {
  MessageBody,
  MessageInput,
  OutgoingMessageStatusSent,
  SendButton,
} from '../../locators/conversation';
import { EnableLinkPreviewsModalButton } from '../../locators/global';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import {
  getDisappearingTestTime,
  getDisappearingTestTiming,
  setDisappearingMessage,
} from '../../utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing link to group',
  risk: 'low',
  testCb: disappearingLinkMessageGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: 'Verifies that a link preview disappears as expected in a group conversation',
});
const timerType = 'Disappear after send option';
const time = getDisappearingTestTime();
const { expectedDuration, maxWait } = getDisappearingTestTiming();

async function disappearingLinkMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  let sentTimestamp: number;
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
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET(time), async () => {
    await setDisappearingMessage(alice1, ['Group', timerType, time]);
  });
  await test.step(TestSteps.SEND.LINK, async () => {
    await alice1.inputText(testLink, new MessageInput(alice1));
    // Enable link preview modal appears as soon as link is typed on android but on iOS it appears after
    await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
      await alice1.checkModalStrings(
        tStripped('linkPreviewsEnable'),
        tStripped('linkPreviewsFirstDescription')
      );
    });
    // Accept link preview modal
    await alice1.clickOnElementAll(new EnableLinkPreviewsModalButton(alice1));
    // On iOS, Appium types so the link preview modal interrupts typing the link, must be deleted and typed again
    await alice1.onIOS().deleteText(new MessageInput(alice1));
    await alice1.onIOS().inputText(testLink, new MessageInput(alice1));
    // Let the preview load (poll rather than a fixed sleep)
    await alice1.waitForTextElementToBePresent(new LinkPreview(alice1));
    await alice1.clickOnElementAll(new SendButton(alice1));
    // Timed from the tap, not from the sent tick below. The timer this test waits out starts when the
    // app sends; the tick is when Appium first observes that, and the gap between them is subtracted
    // from the measured lifetime. `hasElementDisappeared` rejects anything under 0.8x the timer, so on
    // devnet's 10s timer a two-second observation lag is enough to report a correct run as a
    // disappearing-messages bug. Only that floor reads this value — the timeout waiting for the
    // message to go runs on its own clock — so an early reading costs nothing.
    sentTimestamp = Date.now();
    await alice1.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(alice1).build(),
      maxWait: 20000,
    });
  });
  // Wait out the disappearing timer
  await test.step(TestSteps.VERIFY.MESSAGE_DISAPPEARED, async () => {
    if (platform === 'ios') {
      await Promise.all(
        [alice1, bob1, charlie1].map(device =>
          device.hasElementDisappeared({
            ...new MessageBody(device, testLink).build(),
            maxWait,
            expectedDuration,
            actualStartTime: sentTimestamp,
          })
        )
      );
    }
    if (platform === 'android') {
      await Promise.all(
        [alice1, bob1, charlie1].map(device =>
          device.hasElementDisappeared({
            ...new LinkPreviewMessage(device).build(),
            maxWait,
            expectedDuration,
            actualStartTime: sentTimestamp,
          })
        )
      );
    }
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
