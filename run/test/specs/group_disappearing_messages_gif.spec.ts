import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing GIF to group',
  risk: 'low',
  testCb: disappearingGifMessageGroup,
  countOfDevicesNeeded: 3,
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingGifMessageGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Disappear after sent test';
  const testMessage = "Testing disappearing messages for GIF's";
  const {
    devices: { device1, device2, device3 },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  await setDisappearingMessage(platform, device1, ['Group', timerType, time]);
  // Click on attachments button
  await device1.sendGIF(testMessage);
  // Cannot use isAndroid() here
  if (platform === 'android') {
    await Promise.all([
      device2.trustAttachments(testGroupName),
      device3.trustAttachments(testGroupName),
    ]);
  }
  if (platform === 'ios') {
    await Promise.all([
      device2.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: testMessage,
      }),
      device3.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: testMessage,
      }),
    ]);
  }
  if (platform === 'android') {
    await Promise.all([
      device2.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Media message',
      }),
      device3.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Media message',
      }),
    ]);
  }
  // Wait for 30 seconds
  await sleepFor(30000);
  // Check if GIF has been deleted on both devices
  if (platform === 'ios') {
    await Promise.all(
      [device1, device2, device3].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          maxWait: 1000,
          text: testMessage,
        })
      )
    );
  }
  if (platform === 'android') {
    await Promise.all(
      [device1, device2, device3].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Media message',
          maxWait: 1000,
        })
      )
    );
  }

  await closeApp(device1, device2, device3);
}
