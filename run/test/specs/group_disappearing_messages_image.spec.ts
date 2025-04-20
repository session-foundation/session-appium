import { androidIt, iosIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { open3AppsWithFriendsAnd1GroupState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

iosIt('Disappearing image message to group', 'low', disappearingImageMessageGroup);
androidIt('Disappearing image message to group', 'low', disappearingImageMessageGroup);

async function disappearingImageMessageGroup(platform: SupportedPlatformsType) {
  const testMessage = 'Testing disappearing messages for images';
  const testGroupName = 'Testing disappearing messages';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const timerType = 'Disappear after send option';
  const {
    devices: { device1, device2, device3 },
  } = await open3AppsWithFriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });

  await setDisappearingMessage(platform, device1, ['Group', timerType, time]);
  // await device1.navigateBack();
  await device1.sendImage(platform, testMessage);
  await Promise.all([
    device2.onAndroid().trustAttachments(testGroupName),
    device3.onAndroid().trustAttachments(testGroupName),
  ]);
  if (platform === 'ios') {
    await Promise.all(
      [device2, device3].map(device =>
        device.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Message body',
          text: testMessage,
          maxWait: 4000,
        })
      )
    );
  }
  if (platform === 'android') {
    await Promise.all(
      [device2, device3].map(device =>
        device.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Media message',
          maxWait: 1000,
        })
      )
    );
  }
  // Wait for 30 seconds
  await sleepFor(30000);
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
