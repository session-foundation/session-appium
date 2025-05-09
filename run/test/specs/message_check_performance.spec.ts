import { bothPlatformsIt } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Check performance',
  risk: 'low',
  testCb: checkPerformance,
  countOfDevicesNeeded: 2,
});

async function checkPerformance(platform: SupportedPlatformsType) {
  const {
    devices: { alice1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const timesArray: Array<number> = [];

  let i;
  for (i = 1; i <= 10; i++) {
    const timeMs = await alice1.measureSendingTime(i);
    timesArray.push(timeMs);
  }
  console.log(timesArray);
}
