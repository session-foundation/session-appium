import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { TickButton, UsernameInput, UsernameSettings } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { SupportedPlatformsType, closeApp, openAppOnPlatformSingleDevice } from './utils/open_app';

iosIt('Tiny test', undefined, tinyTest, true);
androidIt('Tiny test', undefined, tinyTest, true);

async function tinyTest(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);

  const userA = await newUser(device, USERNAME.ALICE);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await device.clickOnByAccessibilityID('User settings');
  // select username
  await device.clickOnElementAll(new UsernameSettings(device));
  // type in new username
  await sleepFor(100);
  await device.deleteText(new UsernameInput(device));
  await device.inputText(newUsername, new UsernameInput(device));
  await device.clickOnElementAll(new TickButton(device));

  const username = await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: newUsername,
  });

  const changedUsername = await device.getTextFromElement(username);
  console.log('Changed username', changedUsername);
  if (changedUsername === newUsername) {
    console.log('Username change successful');
  }
  if (changedUsername === userA.userName) {
    throw new Error('Username change unsuccessful');
  }
  await device.closeScreen();
  await device.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'User settings',
  });
  await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: newUsername,
  });

  await closeApp(device);
}
