import type { TestInfo } from '@playwright/test';

import { test } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { AccessibilityId } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import {
  EditGroupDescriptionInput,
  GroupDescription,
  SaveGroupNameChangeButton,
  UpdateGroupInformation,
} from './locators/groups';
import { ErrorMessage } from './locators/onboarding';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Change group description',
  risk: 'medium',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: changeGroupDescriptionIOS,
  },
  android: {
    testCb: changeGroupDescriptionAndroid,
  },
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription:
    'Verifies that a group description can be at most 200 chars and that every member can see a valid change.',
});

// Setup
const testGroupName = 'Test group';
const longGroupDescription =
  'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed into a horrible vermin. He lay on his armour-like back, and if he lifted his head a little he could see';
// this check is to avoid false positives
if (longGroupDescription.length <= 200) {
  throw new Error(
    `The string to test the group description length check is too short. It is only:
      ${longGroupDescription.length},
      characters long but needs to be >200. `
  );
}
const trimmedGroupDescription = longGroupDescription.slice(0, 200);

// the expected error is 'Please enter a shorter group description' which is represented by the following localized string
const expectedError = englishStrippedStr(
  'updateGroupInformationEnterShorterDescription'
).toString();

async function changeGroupDescriptionIOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1, charlie1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo,
    });
  });

  await test.step(TestSteps.OPEN.UPDATE_GROUP_INFO, async () => {
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await sleepFor(1000);
    await alice1.clickOnElementAll(new UpdateGroupInformation(alice1, testGroupName));
  });

  await test.step('Verify description length validation', async () => {
    await alice1.inputText(longGroupDescription, new EditGroupDescriptionInput(alice1));
    await alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: expectedError as AccessibilityId,
    });
    await alice1.clickOnByAccessibilityID('Cancel');
  });

  await test.step('Update group description', async () => {
    await alice1.clickOnElementAll(new UpdateGroupInformation(alice1, testGroupName));
    await alice1.inputText(trimmedGroupDescription, new EditGroupDescriptionInput(alice1));
    await alice1.clickOnElementAll(new SaveGroupNameChangeButton(alice1));
  });

  await test.step('Verify description synced to all members', async () => {
    await Promise.all(
      [bob1, charlie1].map(async device => {
        await device.clickOnElementAll(new ConversationSettings(device));
        await device.waitForTextElementToBePresent({
          ...new GroupDescription(device).build(),
          text: trimmedGroupDescription,
        });
      })
    );
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}

async function changeGroupDescriptionAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1, charlie1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo,
    });
  });

  await test.step(TestSteps.OPEN.UPDATE_GROUP_INFO, async () => {
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await sleepFor(1000);
    await alice1.clickOnElementAll(new UpdateGroupInformation(alice1, testGroupName));
  });

  await test.step('Verify description length validation', async () => {
    await alice1.inputText(longGroupDescription, new EditGroupDescriptionInput(alice1));
    const error = await alice1.waitForTextElementToBePresent(new ErrorMessage(alice1));
    const errorMessage = await alice1.getTextFromElement(error);
    if (errorMessage !== expectedError) {
      throw new Error('The observed error message does not match the expected');
    }
  });

  await test.step('Update group description', async () => {
    // Clear the long description
    await alice1.clickOnElementById('clear-input-button-description');
    await alice1.inputText(trimmedGroupDescription, new EditGroupDescriptionInput(alice1));
    await alice1.clickOnElementAll(new SaveGroupNameChangeButton(alice1));
  });

  await test.step('Verify description synced to all members', async () => {
    await Promise.all(
      [bob1, charlie1].map(async device => {
        await device.clickOnElementAll(new ConversationSettings(device));
        await device.waitForTextElementToBePresent(new GroupDescription(device));
        const descriptionElement = await device.waitForTextElementToBePresent({
          strategy: 'xpath',
          selector: `//android.widget.TextView[@text="${trimmedGroupDescription}"]`,
        });
        const descriptionText = await device.getTextFromElement(descriptionElement);
        if (descriptionText !== trimmedGroupDescription) {
          throw new Error(
            `Group description does not match expected.\nExpected: ${trimmedGroupDescription}, Found: ${descriptionText}`
          );
        }
      })
    );
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
