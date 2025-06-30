import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { LinkPreview } from './locators';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';
import { OutgoingMessageStatusSent } from './locators/conversation';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';

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
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after read option';
const testLink = `https://getsession.org/`;

async function disappearingLinkMessage1o1Ios(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // Send a link
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStrippedStr('linkPreviewsEnable').toString(),
    englishStrippedStr('linkPreviewsFirstDescription').toString()
  );
  await alice1.clickOnByAccessibilityID('Enable');
  // No preview on first send
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
  // Wait for link preview to load
  await alice1.waitForTextElementToBePresent(new LinkPreview(alice1));
  await alice1.clickOnByAccessibilityID('Send message button');
  // Make sure image preview is available in device 2
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testLink,
  });
  // Wait for 30 seconds to disappear
  await sleepFor(30000);
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testLink,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testLink,
    }),
  ]);
  await closeApp(alice1, bob1);
}

async function disappearingLinkMessage1o1Android(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // Send a link
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStrippedStr('linkPreviewsEnable').toString(),
    englishStrippedStr('linkPreviewsFirstDescription').toString(),
    false
  );
  await alice1.clickOnByAccessibilityID('Enable');
  // Preview takes a while to load
  await sleepFor(5000);
  await alice1.clickOnByAccessibilityID('Send message button');
  await alice1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(alice1).build(),
    maxWait: 20000,
  });
  // Make sure image preview is available in device 2
  await bob1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/linkPreviewView',
  });
  // Wait for 30 seconds to disappear
  await sleepFor(30000);
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'id',
      selector: 'network.loki.messenger:id/linkPreviewView',
      maxWait: 1000,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'id',
      selector: 'network.loki.messenger:id/linkPreviewView',
      maxWait: 1000,
    }),
  ]);
  await closeApp(alice1, bob1);
}
