import { androidIt, iosIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

iosIt('Disappearing GIF message 1:1', 'low', disappearingGifMessage1o1Ios);
androidIt('Disappearing GIF message 1:1', 'low', disappearingGifMessage1o1Android);

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const testMessage = "Testing disappearing messages for GIF's";

async function disappearingGifMessage1o1Ios(platform: SupportedPlatformsType) {
  const testMessage = "Testing disappearing messages for GIF's";
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
  });
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  // Click on attachments button
  await device1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await device2.trustAttachments(USERNAME.ALICE);
  // Wait for 30 seconds
  await sleepFor(30000);
  // Check if GIF has been deleted on both devices
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testMessage,
  });
  await device2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testMessage,
  });
  await closeApp(device1, device2);
}

async function disappearingGifMessage1o1Android(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
  });
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  // Wait for control messages to disappear before sending image
  // (to check if the control messages are interfering with finding the untrusted attachment message)
  // Click on attachments button
  await device1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await device2.trustAttachments(USERNAME.ALICE);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
  ]);
  // Wait for 30 seconds (time)
  await sleepFor(30000);
  // Check if GIF has been deleted on both devices
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
  ]);
  await closeApp(device1, device2);
}
