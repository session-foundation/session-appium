import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsItSeparate({
  title: 'Disappearing GIF message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingGifMessage1o1Ios,
  },
  android: {
    testCb: disappearingGifMessage1o1Android,
  },
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const testMessage = "Testing disappearing messages for GIF's";

async function disappearingGifMessage1o1Ios(platform: SupportedPlatformsType) {
  const testMessage = "Testing disappearing messages for GIF's";
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // Click on attachments button
  await alice1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await bob1.trustAttachments(USERNAME.ALICE);
  // Wait for 30 seconds
  await sleepFor(30000);
  // Check if GIF has been deleted on both devices
  await alice1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testMessage,
  });
  await bob1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testMessage,
  });
  await closeApp(alice1, bob1);
}

async function disappearingGifMessage1o1Android(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // Wait for control messages to disappear before sending image
  // (to check if the control messages are interfering with finding the untrusted attachment message)
  // Click on attachments button
  await alice1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await bob1.trustAttachments(USERNAME.ALICE);
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
  ]);
  // Wait for 30 seconds (time)
  await sleepFor(30000);
  // Check if GIF has been deleted on both devices
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
  ]);
  await closeApp(alice1, bob1);
}
