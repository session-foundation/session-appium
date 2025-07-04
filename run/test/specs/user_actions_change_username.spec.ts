import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { TickButton, UsernameInput, UsernameSettings } from './locators';
import { SaveNameChangeButton, UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Change username',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  ios: {
    testCb: changeUsernameiOS,
  },
  android: {
    testCb: changeUsernameAndroid,
  },
});

async function changeUsernameiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const alice = await newUser(device, USERNAME.ALICE);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await device.clickOnElementAll(new UserSettings(device));
  // select username
  await device.clickOnElementAll(new UsernameSettings(device));
  // New modal pops up
  await device.checkModalStrings(
    englishStrippedStr('displayNameSet').toString(),
    englishStrippedStr('displayNameVisible').toString()
  );
  // type in new username
  await sleepFor(100);
  await device.deleteText(new UsernameInput(device));
  await device.inputText(newUsername, new UsernameInput(device));
  await device.clickOnElementAll(new SaveNameChangeButton(device));
  const username = await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
  });
  const changedUsername = await device.getTextFromElement(username);
  device.log('Changed username', changedUsername);
  if (changedUsername === newUsername) {
    device.log('Username change successful');
  }
  if (changedUsername === alice.userName) {
    throw new Error('Username change unsuccessful');
  }
  await device.closeScreen();
  await closeApp(device);
}

async function changeUsernameAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const alice = await newUser(device, USERNAME.ALICE);
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
  device.log('Changed username', changedUsername);
  if (changedUsername === newUsername) {
    device.log('Username change successful');
  }
  if (changedUsername === alice.userName) {
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
