import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { TickButton, UsernameInput, UsernameSettings } from './locators';
import { SaveNameChangeButton, UserSettings } from './locators/settings';
import { open_Alice2 } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Change username linked device',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: changeUsernameLinkediOS,
  },
  android: {
    testCb: changeUsernameLinkedAndroid,
  },
});

async function changeUsernameLinkediOS(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, alice2 },
    prebuilt: { alice },
  } = await open_Alice2({ platform });

  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await Promise.all([
    alice1.clickOnElementAll(new UserSettings(alice1)),
    alice2.clickOnElementAll(new UserSettings(alice2)),
  ]);
  // select username
  await alice1.clickOnElementAll(new UsernameSettings(alice1));
  await alice1.checkModalStrings(
    englishStripped('displayNameSet').toString(),
    englishStripped('displayNameVisible').toString()
  );
  // type in new username
  await sleepFor(100);
  await alice1.deleteText(new UsernameInput(alice1));
  await alice1.inputText(newUsername, new UsernameInput(alice1));
  await alice1.clickOnElementAll(new SaveNameChangeButton(alice1));
  const username = await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: newUsername,
  });
  const changedUsername = await alice1.getTextFromElement(username);
  if (changedUsername === alice.userName) {
    throw new Error('Username change unsuccessful');
  }
  await alice1.closeScreen();
  await alice1.clickOnElementAll(new UserSettings(alice1));
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Username',
      text: newUsername,
    }),
    alice2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Username',
      text: newUsername,
    }),
  ]);
  await closeApp(alice1, alice2);
}

async function changeUsernameLinkedAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, alice2 },
    prebuilt: { alice },
  } = await open_Alice2({ platform });

  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await Promise.all([
    alice1.clickOnElementAll(new UserSettings(alice1)),
    alice2.clickOnElementAll(new UserSettings(alice2)),
  ]);
  // select username
  await alice1.clickOnElementAll(new UsernameSettings(alice1));
  // type in new username
  await sleepFor(100);
  await alice1.deleteText(new UsernameInput(alice1));
  await alice1.inputText(newUsername, new UsernameInput(alice1));
  await alice1.clickOnElementAll(new TickButton(alice1));
  const usernameEl = await alice1.waitForTextElementToBePresent(new UsernameSettings(alice1));
  const changedUsername = await alice1.getTextFromElement(usernameEl);
  if (changedUsername === alice.userName) {
    throw new Error('Username change unsuccessful');
  }
  // Get the initial linked username from alice2
  const username2 = await alice2.waitForTextElementToBePresent(new UsernameSettings(alice2));
  let currentLinkedUsername = await alice2.getTextFromElement(username2);

  let currentWait = 0;
  const waitPerLoop = 500;
  const maxWait = 50000;

  do {
    await sleepFor(waitPerLoop);
    // Close the screen and navigate back to the User Settings
    await alice2.closeScreen();
    await alice2.clickOnElementAll(new UserSettings(alice2));
    currentWait += waitPerLoop;
    const linkedUsernameEl = await alice2.waitForTextElementToBePresent(
      new UsernameSettings(alice2)
    );
    currentLinkedUsername = await alice2.getTextFromElement(linkedUsernameEl);
  } while (currentLinkedUsername === alice.userName && currentWait < maxWait);
  {
    console.log('Username not changed yet');
  }
  await closeApp(alice1, alice2);
}
