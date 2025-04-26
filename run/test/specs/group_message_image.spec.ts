import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send image to group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendImageGroupiOS,
  },
  android: {
    testCb: sendImageGroupAndroid,
  },
});

async function sendImageGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const testMessage = 'Sending image to group';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  await alice1.sendImage(platform, testMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: `Message sent status: Sent`,
    maxWait: 50000,
  });
  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
  ]);
  const replyMessage = await bob1.replyToMessage(alice, testMessage);
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
      maxWait: 5000,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
      maxWait: 5000,
    }),
  ]);
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}

async function sendImageGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const testMessage = 'Testing image sending to groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  const replyMessage = `Replying to image from ${alice.userName}`;
  await alice1.sendImage(platform, testMessage);
  // Wait for image to appear in conversation screen
  await sleepFor(500);
  await Promise.all([
    bob1.trustAttachments(testGroupName),
    charlie1.trustAttachments(testGroupName),
  ]);
  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
    }),
  ]);
  // Reply to image - user B
  // Sleep for is waiting for image to load
  await sleepFor(1000);
  await bob1.longPress('Media message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
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
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}
