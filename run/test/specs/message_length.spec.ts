import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  MessageBody,
  MessageInput,
  MessageLengthCountdown,
  MessageLengthOkayButton,
  SendButton,
} from './locators/conversation';
import { PlusButton } from './locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from './locators/start_conversation';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

const maxChars = 2000;
const countdownThreshold = 1800;

const messageLengthTestCases = [
  {
    length: 1799,
    char: 'a',
    shouldSend: true,
    description: 'no countdown shows, message sends',
  },
  { length: 1800, char: 'b', shouldSend: true, description: 'countdown shows 200, message sends' },
  { length: 2000, char: 'c', shouldSend: true, description: 'countdown shows 0, message sends' },
  {
    length: 2001,
    char: 'd',
    shouldSend: false,
    description: 'countdown shows -1, cannot send message',
  },
];

for (const testCase of messageLengthTestCases) {
  bothPlatformsIt({
    title: `Message length limit (${testCase.length} chars)`,
    risk: 'high',
    countOfDevicesNeeded: 1,
    allureSuites: {
      parent: 'Sending Messages',
      suite: 'Rules',
    },
    allureDescription: `Verifies message length behavior at ${testCase.length} characters - ${testCase.description}`,
    testCb: async (platform: SupportedPlatformsType, testInfo: TestInfo) => {
      const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
        const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
        const alice = await newUser(device, USERNAME.ALICE);
        return { device, alice };
      });

      // Send message to self to bring up Note to Self conversation
      await test.step(TestSteps.OPEN.NTS, async () => {
        await device.clickOnElementAll(new PlusButton(device));
        await device.clickOnElementAll(new NewMessageOption(device));
        await device.inputText(alice.accountID, new EnterAccountID(device));
        await device.scrollDown();
        await device.clickOnElementAll(new NextButton(device));
      });

      await test.step(`Type ${testCase.length} chars, check countdown`, async () => {
        const expectedCount =
          testCase.length < countdownThreshold ? null : (maxChars - testCase.length).toString();

        // Construct the string of desired length
        const message = testCase.char.repeat(testCase.length);
        await device.inputText(message, new MessageInput(device));

        // Does the countdown appear?
        if (expectedCount) {
          await device.waitForTextElementToBePresent(
            new MessageLengthCountdown(device, expectedCount)
          );
        } else {
          await device.verifyElementNotPresent(new MessageLengthCountdown(device));
        }

        await device.clickOnElementAll(new SendButton(device));

        // Is the message short enough to send?
        if (testCase.shouldSend) {
          await device.waitForTextElementToBePresent(new MessageBody(device, message));
        } else {
          // Modal appears, verify and dismiss
          await device.checkModalStrings(
            englishStrippedStr('modalMessageTooLongTitle').toString(),
            englishStrippedStr('modalMessageTooLongDescription')
              .withArgs({ limit: maxChars.toString() })
              .toString()
          );
          await device.clickOnElementAll(new MessageLengthOkayButton(device));
          await device.verifyElementNotPresent(new MessageBody(device, message));
        }
      });

      await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
        await closeApp(device);
      });
    },
  });
}
