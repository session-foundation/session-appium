import { test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { tStripped } from '../../../localizer/lib';
import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { type User, USERNAME } from '../../../types/testing';
import {
  MessageBody,
  MessageInput,
  MessageLengthCountdown,
  MessageLengthOkayButton,
  SendButton,
} from '../../locators/conversation';
import { CTAButtonNegative } from '../../locators/global';
import { PlusButton } from '../../locators/home';
import { ConversationItem } from '../../locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from '../../locators/start_conversation';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { observeProGrant } from '../../utils/pro_refresh';

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
    countOfDevicesNeeded: testCase.shouldSend ? 2 : 1,
    isPro: testCase.pro,
    allureSuites: {
      parent: 'Sending Messages',
      suite: 'Rules',
    },
    allureDescription: `Verifies message length behavior at ${testCase.length} characters - ${testCase.description} (${proSuffix})`,
    testCb: async (platform: SupportedPlatformsType, testInfo: TestInfo) => {
      // A recipient is the point for anything that sends: an over-standard-length message carries Pro
      // features the RECEIVING client validates, so a missing or invalid proof lets the sender compose
      // and send happily while the message never arrives. Note to Self cannot show that — it is the
      // same account on the same device.
      //
      // The cases that cannot send need no recipient and stay on one device.
      let device: DeviceWrapper;
      let recipient: DeviceWrapper | undefined;
      let alice: User;
      let recipientName: string | undefined;

      if (testCase.shouldSend) {
        const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
          return await open_Alice1_Bob1_friends({
            platform,
            focusFriendsConvo: true,
            testInfo,
            iOSContext: IOS_PRO_CONTEXT,
          });
        });
        device = devices.alice1;
        recipient = devices.bob1;
        alice = prebuilt.alice;
        recipientName = prebuilt.bob.userName;
      } else {
        const setup = await test.step(TestSteps.SETUP.NEW_USER, async () => {
          const { device: only } = await openAppOnPlatformSingleDevice(
            platform,
            testInfo,
            IOS_PRO_CONTEXT
          );
          const user = await newUser(only, USERNAME.ALICE);
          return { only, user };
        });
        device = setup.only;
        alice = setup.user;
      }

      if (testCase.pro) {
        await makeAccountPro({ user: alice, platform });
        await observeProGrant(device);
        if (recipientName) {
          await device.clickOnElementAll(new ConversationItem(device, recipientName));
        }
      }

      if (!testCase.shouldSend) {
        // Send to self, since nothing leaves the device on these cases.
        await test.step(TestSteps.OPEN.NTS, async () => {
          await device.clickOnElementAll(new PlusButton(device));
          await device.clickOnElementAll(new NewMessageOption(device));
          await device.inputText(alice.accountID, new EnterAccountID(device));
          // The keyboard covers Next on smaller screens. Do NOT swipe here: this is a bottom sheet,
          // so a scroll drags the sheet and the tap silently misses.
          await device.hideKeyboard();
          await device.clickOnElementAll(new NextButton(device));
        });
      }

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
          await device.verifyElementNotPresent({
            ...new MessageLengthCountdown(device).build(),
            maxWait: 1000,
          });
        }

        await device.clickOnElementAll(new SendButton(device));

        // Is the message short enough to send?
        if (testCase.shouldSend) {
          await device.waitForTextElementToBePresent(new MessageBody(device, message));
          // The half Note to Self could never prove: the recipient accepted and rendered it. Asserted
          // where the recipient already is — `focusFriendsConvo` leaves both devices in the
          // conversation, so reopening it by name is a step that can only fail.
          if (recipient) {
            await recipient.waitForTextElementToBePresent(new MessageBody(recipient, message));
          }
        } else if (!testCase.pro) {
          // For Non Pro, a CTA appears
          await device.checkCTA('longerMessages');
          await device.clickOnElementAll(new CTAButtonNegative(device));
          await device.verifyElementNotPresent({
            ...new MessageBody(device, message).build(),
            maxWait: 1000,
          });
        } else if (testCase.pro) {
          // For Pro, a normal message length dialog appears
          await device.checkModalStrings(
            tStripped('modalMessageTooLongTitle'),
            // Mobile doesn't group the number ("10000"); Desktop does ("10,000") and is the
            // behaviour we want. Deferred to Session 2.0.
            tStripped('modalMessageTooLongDescription', { limit: expectedMax.toString() })
          );
          await device.clickOnElementAll(new MessageLengthOkayButton(device));
          await device.verifyElementNotPresent({
            ...new MessageBody(device, message).build(),
            maxWait: 1000,
          });
        }
      });

      await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
        await closeApp(device);
      });
    },
  });
}
