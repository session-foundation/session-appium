import { englishStripped } from '../../localizer/i18n/localizedString';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { TickButton, UsernameInput, UsernameSettings } from './locators';
import { SaveNameChangeButton, UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Change username linked device', 'medium', changeUsernameLinkediOS);
androidIt('Change username linked device', 'medium', changeUsernameLinkedAndroid);

async function changeUsernameLinkediOS(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE);
  const newUsername = 'Alice in chains';
  // click on settings/profile avatar
  await Promise.all([
    device1.clickOnElementAll(new UserSettings(device1)),
    device2.clickOnElementAll(new UserSettings(device2)),
  ]);
  // select username
  await device1.clickOnElementAll(new UsernameSettings(device1));
  await device1.checkModalStrings(
    englishStripped('displayNameSet').toString(),
    englishStripped('displayNameVisible').toString()
  );
  // type in new username
  await sleepFor(100);
  await device1.deleteText(new UsernameInput(device1));
  await device1.inputText(newUsername, new UsernameInput(device1));
  await device1.clickOnElementAll(new SaveNameChangeButton(device1));
  const username = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: newUsername,
  });
  const changedUsername = await device1.getTextFromElement(username);
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
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE);
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
  });
  const changedUsername = await device1.getTextFromElement(username);
  if (changedUsername === userA.userName) {
    throw new Error('Username change unsuccessful');
  }
  // Get the initial linked username from device2
  const username2 = await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
  });
  let currentLinkedUsername = await device2.getTextFromElement(username2);

  // If the linked username still equals the original, then enter a loop to try again.
  if (currentLinkedUsername === userA.userName) {
    let currentWait = 0;
    const waitPerLoop = 500;
    const maxWait = 50000;

    while (currentWait < maxWait) {
      // Wait before trying again
      await sleepFor(waitPerLoop);

      // Close the screen and navigate back to the User Settings
      await device2.closeScreen();
      await device2.clickOnElementAll(new UserSettings(device2));

      currentWait += waitPerLoop;

      // Retrieve the updated username
      const linkedUsernameEl = await device2.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Display name',
      });
      currentLinkedUsername = await device2.getTextFromElement(linkedUsernameEl);
      // If the linked username now matches the changed username, break out.
      if (currentLinkedUsername === changedUsername) {
        console.log('Username change successful');
        break;
      }
    }

    // After looping, if the linked username still equals the original, then fail.
    if (currentLinkedUsername === userA.userName) {
      throw new Error('Username change unsuccessful');
    }
  } else {
    console.log('Username change successful');
  }
  await closeApp(device1, device2);
}
