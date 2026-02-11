import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ClearInputButton, EditUsernameButton, UsernameDisplay, UsernameInput } from './locators';
import { SaveNameChangeButton, UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Change username',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: changeUsername,
  allureLinks: {
    android: 'SES-4277',
  },
});

async function changeUsername(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await device.clickOnElementAll(new UserSettings(device));
  // select username
  await device.clickOnElementAll(new EditUsernameButton(device));
  await device.checkModalStrings(tStripped('displayNameSet'), tStripped('displayNameVisible'));
  await device.onIOS().deleteText(new UsernameInput(device));
  await device.onAndroid().clickOnElementAll(new ClearInputButton(device));
  await device.inputText(newUsername, new UsernameInput(device));
  await device.clickOnElementAll(new SaveNameChangeButton(device));
  await device.waitForTextElementToBePresent(new UsernameDisplay(device, newUsername));
  await closeApp(device);
}
