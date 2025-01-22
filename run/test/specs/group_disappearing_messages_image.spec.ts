import { androidIt, iosIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

iosIt('Disappearing image message to group', 'low', disappearingImageMessageGroup);
androidIt('Disappearing image message to group', 'low', disappearingImageMessageGroup);

async function disappearingImageMessageGroup(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const testMessage = 'Testing disappearing messages for images';
  const testGroupName = 'Test group';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const timerType = 'Disappear after send option';
  // Create user A and user B
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);

  await setDisappearingMessage(platform, device1, ['Group', timerType, time]);
  await device1.sendImage(platform, testMessage);
  await Promise.all([
    device2.onAndroid().trustAttachments(testGroupName),
    device3.onAndroid().trustAttachments(testGroupName),
  ]);
  const selector = platform === 'android' ? 'Media message' : 'Message body';
  const text = platform === 'android' ? undefined : testMessage;

  await Promise.all(
    [device2, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: selector,
        maxWait: 1000,
        text: text,
      })
    )
  );
  // Wait for 30 seconds
  await sleepFor(30000);
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: selector,
        maxWait: 1000,
        text: text,
      })
    )
  );
  await closeApp(device1, device2, device3);
}
