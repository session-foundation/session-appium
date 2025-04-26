import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { LinkPreview, LinkPreviewMessage } from './locators';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send link 1:1',
  risk: 'high',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendLinkIos,
  },
  android: {
    testCb: sendLinkAndroid,
  },
});

async function sendLinkIos(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const testLink = `https://getsession.org/`;

  const replyMessage = `Replying to link from ${alice.userName}`;
  // Send a link

  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // await alice1.waitForLoadingAnimation();
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Sent',
    maxWait: 20000,
  });
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStripped('linkPreviewsEnable').toString(),
    englishStripped('linkPreviewsFirstDescription').toString()
  );
  await alice1.clickOnByAccessibilityID('Enable');
  await alice1.clickOnByAccessibilityID('Send message button');
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

  await bob1.longPressMessage(testLink);
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await closeApp(alice1, bob1);
}

async function sendLinkAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const testLink = `https://getsession.org/`;

  // Send a link
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStripped('linkPreviewsEnable').toString(),
    englishStripped('linkPreviewsFirstDescription').toString(),
    true
  );
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Enable',
  });
  //wait for preview to generate
  await sleepFor(5000);
  await alice1.clickOnByAccessibilityID('Send message button');
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Sent',
    maxWait: 25000,
  });
  await bob1.waitForTextElementToBePresent(new LinkPreviewMessage(bob1));
  await closeApp(alice1, bob1);
}
