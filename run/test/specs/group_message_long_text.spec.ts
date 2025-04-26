import { longText } from '../../constants';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send long message to group',
  risk: 'low',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendLongMessageGroupiOS,
  },
  android: {
    testCb: sendLongMessageGroupAndroid,
  },
});

async function sendLongMessageGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  // Sending a long text message

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  await alice1.sendMessage(longText);
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: longText,
  });
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: longText,
  });
  const replyMessage = await bob1.replyToMessage(alice, longText);
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
  // Close app
  await closeApp(alice1, bob1, charlie1);
}

async function sendLongMessageGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });

  // Sending a long text message
  await alice1.inputText(longText, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Click send
  await alice1.clickOnByAccessibilityID('Send message button');
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: `Message sent status: Sent`,
    maxWait: 50000,
  });

  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: longText,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: longText,
    }),
  ]);
  await bob1.longPressMessage(longText);
  await bob1.clickOnByAccessibilityID('Reply to message');
  const replyMessage = await bob1.sendMessage(`${alice.userName} message reply`);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // TO FIX: REPLY NOT FOUND ANDROID
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app
  await closeApp(alice1, bob1, charlie1);
}
