import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt('Disappearing GIF to group', 'low', disappearingGifMessageGroup);

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingGifMessageGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Disappear after sent test';
  const testMessage = "Testing disappearing messages for GIF's";
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create user A and user B
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
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
