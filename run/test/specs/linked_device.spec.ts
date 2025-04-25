import { bothPlatformsIt } from '../../types/sessionIt';
import { UserSettings } from './locators/settings';
import { open2AppsLinkedUser } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Link device',
  risk: 'high',
  testCb: linkDevice,
  countOfDevicesNeeded: 2,
});

async function linkDevice(platform: SupportedPlatformsType) {
  // Open server and two devices
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsLinkedUser({ platform });
  // Check that 'Youre almost finished' reminder doesn't pop up on device2
  await device2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Recovery phrase reminder',
    maxWait: 1000,
  });
  // Verify username and session ID match
  await device2.clickOnElementAll(new UserSettings(device2));
  // Check username
  await device2.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: userA.userName,
  });

  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
    text: userA.userName,
  });

  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Account ID',
    text: userA.sessionId,
  });

  await closeApp(device1, device2);
}
