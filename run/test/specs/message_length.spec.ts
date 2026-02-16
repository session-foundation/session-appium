import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  MessageBody,
  MessageInput,
  MessageLengthCountdown,
  MessageLengthOkayButton,
  SendButton,
} from '../locators/conversation';
import { CTAButtonNegative } from '../locators/global';
import { PlusButton } from '../locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from '../locators/start_conversation';
import { IOSTestContext } from '../utils/capabilities_ios';
import { newUser } from '../utils/create_account';
import { makeAccountPro } from '../utils/mock_pro';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { forceStopAndRestart } from '../utils/utilities';

const STANDARD_MAX_CHARS = 2000;
const PRO_MAX_CHARS = 10000;
const COUNTDOWN_START_THRESHOLD = 200;

const messageLengthTestCases = [
  {
    pro: false,
    length: 1799,
    shouldSend: true,
    description: 'no countdown shows, message sends',
  },
  {
    pro: false,
    length: 1800,
    shouldSend: true,
    description: 'countdown shows 200, message sends',
  },
  {
    pro: false,
    length: 2000,
    shouldSend: true,
    description: 'countdown shows 0, message sends',
  },
  {
    pro: false,
    length: 2001,
    shouldSend: false,
    description: 'countdown shows -1, cannot send message',
  },
  {
    pro: true,
    length: 9799,
    shouldSend: true,
    description: 'no countdown shows, message sends',
  },
  {
    pro: true,
    length: 9800,
    shouldSend: true,
    description: 'countdown shows 200, message sends',
  },
  {
    pro: true,
    length: 10000,
    shouldSend: true,
    description: 'countdown shows 0, message sends',
  },
  {
    pro: true,
    length: 10001,
    shouldSend: false,
    description: 'countdown shows -1, cannot send message',
  },
];

for (const testCase of messageLengthTestCases) {
  const proSuffix = testCase.pro ? `Pro` : `non Pro`;
  bothPlatformsIt({
    title: `Message length limit (${testCase.length} chars ${proSuffix})`,
    risk: 'high',
    countOfDevicesNeeded: 1,
    allureSuites: {
      parent: 'Sending Messages',
      suite: 'Rules',
    },
    allureDescription: `Verifies message length behavior at ${testCase.length} characters - ${testCase.description} (${proSuffix})`,
    testCb: async (platform: SupportedPlatformsType, testInfo: TestInfo) => {
      const iosContext: IOSTestContext = {
        sessionProEnabled: 'true',
      };
      const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
        const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
        const alice = await newUser(device, USERNAME.ALICE);
        return { device, alice };
      });

      if (testCase.pro) {
        const paymentProvider = platform === 'ios' ? 'apple' : 'google';
        await makeAccountPro({
          mnemonic: alice.recoveryPhrase,
          provider: paymentProvider,
        });
        // Restart to notify app of Pro status change
        await forceStopAndRestart(device);
        await device.dismissCTA();
      }

      // Send message to self to bring up Note to Self conversation
      await test.step(TestSteps.OPEN.NTS, async () => {
        await device.clickOnElementAll(new PlusButton(device));
        await device.clickOnElementAll(new NewMessageOption(device));
        await device.inputText(alice.accountID, new EnterAccountID(device));
        await device.scrollDown();
        await device.clickOnElementAll(new NextButton(device));
      });

      await test.step(`Type ${testCase.length} chars, check countdown`, async () => {
        const expectedMax = testCase.pro ? PRO_MAX_CHARS : STANDARD_MAX_CHARS;
        const expectedCount =
          testCase.length < expectedMax - COUNTDOWN_START_THRESHOLD
            ? null
            : (expectedMax - testCase.length).toString();

        // Construct the string of desired length
        const message = 'x'.repeat(testCase.length);
        await device.inputText(message, new MessageInput(device), true);

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
        } else if (!testCase.pro) {
          // For Non Pro, a CTA appears
          await device.checkCTA('longerMessages');
          await device.clickOnElementAll(new CTAButtonNegative(device));
          await device.verifyElementNotPresent(new MessageBody(device, message));
        } else if (testCase.pro) {
          // For Pro, a normal message length dialog appears
          await device.checkModalStrings(
            tStripped('modalMessageTooLongTitle'),
            tStripped('modalMessageTooLongDescription', { limit: expectedMax.toString() })
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
