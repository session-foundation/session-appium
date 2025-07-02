import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { LinkPreview, LinkPreviewMessage } from './locators';
import { OutgoingMessageStatusSent } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing link to group',
  risk: 'low',
  testCb: disappearingLinkMessageGroup,
  countOfDevicesNeeded: 3,
});
const timerType = 'Disappear after send option';
const time = DISAPPEARING_TIMES.THIRTY_SECONDS;

async function disappearingLinkMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Testing disappearing messages';
  const testLink = `https://getsession.org/`;
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });

  await setDisappearingMessage(platform, alice1, ['Group', timerType, time]);
  // Send a link
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Enable link preview modal appears as soon as link is typed on android but on iOS it appears after
  if (platform === 'android') {
    await alice1.checkModalStrings(
      englishStrippedStr('linkPreviewsEnable').toString(),
      englishStrippedStr('linkPreviewsFirstDescription').toString(),
      true
    );
    await alice1.clickOnByAccessibilityID('Enable');
  }

  if (platform === 'ios') {
    await alice1.checkModalStrings(
      englishStrippedStr('linkPreviewsEnable').toString(),
      englishStrippedStr('linkPreviewsFirstDescription').toString()
    );
    await alice1.clickOnByAccessibilityID('Enable');
  }
  // Accept dialog for link preview
  // Let preview load
  await sleepFor(5000);
  await alice1.clickOnByAccessibilityID('Send message button');
  await alice1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(alice1).build(),
    maxWait: 20000,
  });

  // Send again for image
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  if (platform === 'ios') {
    await alice1.waitForTextElementToBePresent(new LinkPreview(alice1));
  } else {
    await sleepFor(5000);
  }
  await alice1.clickOnByAccessibilityID('Send message button');
  // Make sure image preview is available in device 2
  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testLink,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testLink,
    }),
  ]);
  // Wait for 30 seconds to disappear
  await sleepFor(30000);
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          maxWait: 1000,
          text: testLink,
        })
      )
    );
  }
  if (platform === 'android') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementBeenDeleted({ ...new LinkPreviewMessage(device).build(), maxWait: 1000 })
      )
    );
  }
  await closeApp(alice1, bob1, charlie1);
}
