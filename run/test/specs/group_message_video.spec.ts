import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsItSeparate({
  title: 'Send video to group',
  risk: 'medium',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendVideoGroupiOS,
  },
  android: {
    testCb: sendVideoGroupAndroid,
  },
});

async function sendVideoGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  const testMessage = 'Testing-video-1';
  const replyMessage = `Replying to video from ${alice.userName} in ${testGroupName}`;
  await alice1.sendVideoiOS(testMessage);
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
    maxWait: 5000,
  });
  await bob1.longPressMessage(testMessage);
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}

async function sendVideoGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Test sending a video
  // open devices
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  const replyMessage = `Replying to video from ${alice.userName} in ${testGroupName}`;
  // Click on attachments button
  await alice1.sendVideoAndroid();
  await Promise.all([
    bob1.trustAttachments(testGroupName),
    charlie1.trustAttachments(testGroupName),
  ]);
  // Check video appears in device 2 and device 3
  // (wait for loading animation to disappear and play icon to appear)
  // Device 2
  await Promise.all([
    bob1.waitForLoadingMedia(),
    bob1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'network.loki.messenger:id/play_overlay',
      maxWait: 8000,
    }),
  ]);
  // Device 3
  await Promise.all([
    charlie1.waitForLoadingMedia(),
    charlie1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'network.loki.messenger:id/play_overlay',
      maxWait: 8000,
    }),
  ]);
  // Reply to message on device 2
  await bob1.longPress('Media message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  // Check reply appears in device 1 and device 3
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
  ]);
  // Close app and server
  await closeApp(alice1, bob1, charlie1);
}
