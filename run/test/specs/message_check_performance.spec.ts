import { bothPlatformsIt } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Check performance', undefined, checkPerformance);

async function checkPerformance(platform: SupportedPlatformsType) {
  const {
    devices: { device1 },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const timesArray: Array<number> = [];

  let i;
  for (i = 1; i <= 10; i++) {
    const timeMs = await device1.measureSendingTime(i);
    timesArray.push(timeMs);
  }
  console.log(timesArray);
}
