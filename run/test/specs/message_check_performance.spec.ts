import { bothPlatformsIt } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Check performance',
  risk: undefined, // does it really make sense to allow risk to be undefined?
  testCb: checkPerformance,
  countOfDevicesNeeded: 2,
});

async function checkPerformance(platform: SupportedPlatformsType) {
  const {
    devices: { device1 },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  const timesArray: Array<number> = [];

  let i;
  for (i = 1; i <= 10; i++) {
    const timeMs = await device1.measureSendingTime(i);
    timesArray.push(timeMs);
  }
  console.log(timesArray);
}
