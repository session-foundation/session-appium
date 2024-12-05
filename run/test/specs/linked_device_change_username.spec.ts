import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { TickButton, UsernameInput, UsernameSettings } from './locators';
import { UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Change username linked device', 'medium', changeUsernameLinkediOS);
androidIt('Change username linked device', 'medium', changeUsernameLinkedAndroid);

async function changeUsernameLinkediOS(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);

  const userA = await linkedDevice(device1, device2, USERNAME.ALICE, platform);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await Promise.all([
    device1.clickOnElementAll(new UserSettings(device1)),
    device2.clickOnElementAll(new UserSettings(device2)),
  ]);
  // select username
  await device1.clickOnElementAll(new UsernameSettings(device1));
  // type in new username
  await sleepFor(100);
  await device1.deleteText(new UsernameInput(device1));
  await device1.inputText(newUsername, new UsernameInput(device1));
  await device1.clickOnElementAll(new TickButton(device1));

  const username = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: newUsername,
  });

  const changedUsername = await device1.getTextFromElement(username);
  console.log('Changed username', changedUsername);
  if (changedUsername === newUsername) {
    console.log('Username change successful');
  }
  if (changedUsername === userA.userName) {
    throw new Error('Username change unsuccessful');
  }
  await device1.closeScreen();
  await device1.clickOnElementAll(new UserSettings(device1));
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Username',
      text: newUsername,
    }),
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Username',
      text: newUsername,
    }),
  ]);
  await closeApp(device1, device2);
}

async function changeUsernameLinkedAndroid(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);

  const userA = await linkedDevice(device1, device2, USERNAME.ALICE, platform);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await Promise.all([
    device1.clickOnElementAll(new UserSettings(device1)),
    device2.clickOnElementAll(new UserSettings(device2)),
  ]);
  // select username
  await device1.clickOnElementAll(new UsernameSettings(device1));
  // type in new username
  await sleepFor(100);
  await device1.deleteText(new UsernameInput(device1));
  await device1.inputText(newUsername, new UsernameInput(device1));
  await device1.clickOnElementAll(new TickButton(device1));
  const username = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
    text: newUsername,
  });
  const changedUsername = await device1.getTextFromElement(username);
  console.log('Changed username', changedUsername);
  if (changedUsername === newUsername) {
    console.log('Username change successful');
  }
  if (changedUsername === userA.userName) {
    throw new Error('Username change unsuccessful');
  }
  await device1.closeScreen();
  await device1.clickOnElementAll(new UserSettings(device1));

  await device2.closeScreen();
  await device2.clickOnElementAll(new UserSettings(device2));

  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Display name',
      text: newUsername,
    }),
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Display name',
      text: newUsername,
    }),
  ]);

  await closeApp(device1, device2);
}
