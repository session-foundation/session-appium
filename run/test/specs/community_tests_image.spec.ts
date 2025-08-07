import { test, type TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { joinCommunity } from './utils/join_community';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

// NOTE For some reason Appium takes FOREVER to load the iOS page source of the community on the recipients device
// and as such I haven't found a quick and easy way to verify that they see the new image message
// If this becomes a problem in the future then we can extract the unread count from page source and see it increment after the image gets sent
// But for now we have to trust that the sender seeing 'Sent' also delivers it to others on iOS
// This is also why it's a 1-device test and has its own iosIt definition (and not bothPlatformsItSeparate)

androidIt({
  title: 'Send image to community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: sendImageCommunityAndroid,
  allureSuites: { parent: 'Sending Messages', suite: 'Sending Attachments' },
  allureDescription: 'Verifies that an image can be sent and received in a community',
});

iosIt({
  title: 'Send image to community',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: sendImageCommunityIOS,
  allureSuites: { parent: 'Sending Messages', suite: 'Sending Attachments' },
  allureDescription: `Verifies that an image can be sent to a community. 
  Note that due to Appium's limitations, this test does not verify another device receiving the image.`,
});

async function sendImageCommunityAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
    });
  });
  const testImageMessage = `Image message + ${new Date().getTime()} - ${platform}`;
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await Promise.all(
      [alice1, bob1].map(async device => {
        await joinCommunity(device, testCommunityLink, testCommunityName);
      })
    );
  });
  await test.step(TestSteps.SEND.IMAGE, async () => {
    await alice1.sendImage(testImageMessage, true);
  });
  await test.step(TestSteps.VERIFY.MESSAGE_RECEIVED, async () => {
    await sleepFor(5000); // Give bob some time to receive the message so the test doesn't scroll down too early
    await bob1.scrollToBottom();
    await bob1.trustAttachments(testCommunityName);
    await bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testImageMessage,
    });
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
async function sendImageCommunityIOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  const testImageMessage = `Image message + ${new Date().getTime()} - ${platform}`;
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await joinCommunity(device, testCommunityLink, testCommunityName);
  });
  await test.step(TestSteps.SEND.IMAGE, async () => {
    await device.sendImage(testImageMessage, true);
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
