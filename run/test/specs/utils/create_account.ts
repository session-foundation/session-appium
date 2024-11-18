import { sleepFor } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User, USERNAME } from '../../../types/testing';
import { ExitUserProfile, RevealRecoveryPhraseButton } from '../locators';
import { UserSettings } from '../locators/settings';
import { SupportedPlatformsType } from './open_app';

export const newUser = async (
  device: DeviceWrapper,
  userName: USERNAME,
  _platform: SupportedPlatformsType
): Promise<User> => {
  // Click create session ID

  await device.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Create account button',
  });
  // Input username
  await device.inputText(userName, {
    strategy: 'accessibility id',
    selector: 'Enter display name',
  });
  // Click continue
  await device.clickOnByAccessibilityID('Continue');
  // Choose message notification options
  // Want to choose 'Slow Mode' so notifications don't interrupt test
  await device.clickOnByAccessibilityID('Slow mode notifications button');
  // Select Continue to save notification settings
  await device.clickOnByAccessibilityID('Continue');
  // TODO need to retry check every 1s for 5s
  console.warn('about to look for Allow permission in 5s');
  await sleepFor(5000);

  await device.checkPermissions('Allow');
  console.warn('looked for Allow permission');
  await sleepFor(1000);
  // Click on 'continue' button to open recovery phrase modal
  await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Reveal recovery phrase button',
  });
  await device.clickOnElementAll(new RevealRecoveryPhraseButton(device));
  //Save recovery password
  await device.clickOnByAccessibilityID('Recovery password container');
  await device.onAndroid().clickOnByAccessibilityID('Copy button');
  // Save recovery phrase as variable
  const recoveryPhrase = await device.grabTextFromAccessibilityId('Recovery password container');
  console.log(`${userName}s recovery phrase is "${recoveryPhrase}"`);
  // Exit Modal
  await device.navigateBack();
  await device.clickOnElementAll(new UserSettings(device));
  const accountID = await device.grabTextFromAccessibilityId('Account ID');
  await device.clickOnElementAll(new ExitUserProfile(device));
  return { userName, accountID, recoveryPhrase };
};
