import { buildStateForTest } from '@session-foundation/qa-seeder';
import { androidIt, iosIt } from '../../types/sessionIt';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';
import type { TestInfo } from '@playwright/test';
import { restoreAccountNoFallback } from './utils/restore_account';

iosIt('Tiny test', undefined, tinyTest, false);
androidIt('Tiny test', undefined, tinyTest, false);

async function tinyTest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const [devicesObj, prebuilt] = await Promise.all([
    openAppThreeDevices(platform),
    buildStateForTest('3friendsInGroup', testInfo.title, 'mainnet'),
  ]);

  const devices = [devicesObj.device1, devicesObj.device2, devicesObj.device3];

  await Promise.all(
    devices.map((d, index) => {
      const seedPhrase = prebuilt.users[index].seedPhrase as string;
      if (!seedPhrase) {
        throw new Error(`No seed phrase found for user ${index}`);
      }
      return restoreAccountNoFallback(d, seedPhrase);
    })
  );

  await sleepFor(30000000);

  // // click on settings/profile avatar
  // await device.clickOnByAccessibilityID('User settings');
  // // select username
  // await device.clickOnElementAll(new UsernameSettings(device));
  // // type in new username
  // await sleepFor(100);
  // await device.deleteText(new UsernameInput(device));
  // await device.inputText(newUsername, new UsernameInput(device));
  // await device.clickOnElementAll(new TickButton(device));

  // const username = await device.waitForTextElementToBePresent({
  //   strategy: 'accessibility id',
  //   selector: 'Username',
  //   text: newUsername,
  // });

  // const changedUsername = await device.getTextFromElement(username);
  // console.log('Changed username', changedUsername);
  // if (changedUsername === newUsername) {
  //   console.log('Username change successful');
  // }
  // if (changedUsername === userA.userName) {
  //   throw new Error('Username change unsuccessful');
  // }
  // await device.closeScreen();
  // await device.clickOnElementAll({
  //   strategy: 'accessibility id',
  //   selector: 'User settings',
  // });
  // await device.waitForTextElementToBePresent({
  //   strategy: 'accessibility id',
  //   selector: 'Username',
  //   text: newUsername,
  // });

  await closeApp(...devices);
}
