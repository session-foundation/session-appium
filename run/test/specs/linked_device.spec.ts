import { bothPlatformsIt } from '../../types/sessionIt';
import { UserSettings } from './locators/settings';
import { open_Alice2 } from './state_builder';
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
    devices: { alice1, alice2 },
    prebuilt: { alice },
  } = await open_Alice2({ platform });
  // Check that 'Youre almost finished' reminder doesn't pop up on alice2
  await alice2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Recovery phrase reminder',
    maxWait: 1000,
  });
  // Verify username and session ID match
  await alice2.clickOnElementAll(new UserSettings(alice2));
  // Check username
  await alice2.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: alice.userName,
  });

  await alice2.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
    text: alice.userName,
  });

  await alice2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Account ID',
    text: alice.sessionId,
  });

  await closeApp(alice1, alice2);
}
