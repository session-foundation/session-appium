import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { ClearInputButton, EditUsernameButton, UsernameDisplay, UsernameInput } from './locators';
import { SaveNameChangeButton, UserSettings } from './locators/settings';
import { open_Alice2 } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Change username linked device',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: changeUsernameLinked,
});

async function changeUsernameLinked(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform, testInfo });

  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await Promise.all([
    alice1.clickOnElementAll(new UserSettings(alice1)),
    alice2.clickOnElementAll(new UserSettings(alice2)),
  ]);
  // select username
  await alice1.clickOnElementAll(new EditUsernameButton(alice1));
  // type in new username
  await sleepFor(100);
  await alice1.onIOS().deleteText(new UsernameInput(alice1));
  await alice1.onAndroid().clickOnElementAll(new ClearInputButton(alice1));
  await alice1.inputText(newUsername, new UsernameInput(alice1));
  await alice1.clickOnElementAll(new SaveNameChangeButton(alice1));
  await alice2.waitForTextElementToBePresent(new UsernameDisplay(alice2, newUsername));
  await closeApp(alice1, alice2);
}
