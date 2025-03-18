import { englishStripped } from '../../localizer/i18n/localizedString';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { TickButton, UsernameInput, UsernameSettings } from './locators';
import { SaveNameChangeButton, UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { SupportedPlatformsType, closeApp, openAppOnPlatformSingleDevice } from './utils/open_app';

iosIt('Change username', 'medium', changeUsernameiOS);
androidIt('Change username', 'medium', changeUsernameAndroid);

async function changeUsernameiOS(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);

  const userA = await newUser(device, USERNAME.ALICE);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await device.clickOnElementAll(new UserSettings(device));
  // select username
  await device.clickOnElementAll(new UsernameSettings(device));
  // New modal pops up
  await device.checkModalStrings(
    englishStripped('displayNameSet').toString(),
    englishStripped('displayNameVisible').toString()
  );
  // type in new username
  await sleepFor(100);
  // await device.waitForTextElementToBePresent(new UsernameInput(device));
  // await device.clickOnElementAll(new UsernameInput(device));
  await device.deleteText(new UsernameInput(device));
  await device.inputText(newUsername, new UsernameInput(device));
  await device.clickOnElementAll(new SaveNameChangeButton(device));

  const username = await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    // text: newUsername,
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
  await closeApp(device);
}

async function changeUsernameAndroid(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);

  const userA = await newUser(device, USERNAME.ALICE);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await device.clickOnElementAll(new UserSettings(device));
  // select username
  await device.clickOnElementAll(new UsernameSettings(device));
  // type in new username
  await sleepFor(100);
  await device.deleteText(new UsernameInput(device));
  await device.inputText(newUsername, new UsernameInput(device));
  await device.clickOnElementAll(new TickButton(device));
  const username = await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
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
  await device.clickOnElementAll(new UserSettings(device));

  await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
    text: newUsername,
  });

  await closeApp(device);
}
