import { test, type TestInfo } from '@playwright/test';

import { STANDARD_PIN_LIMIT } from '../../../shared/constants';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CTAButtonNegative } from '../../locators/global';
import { PlusButton } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { assertPinOrder, getConversationOrder } from '../../utils/conversation_order';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { forceStopAndRestart } from '../../utils/utilities';

/**
 * PROBE — not for merging.
 *
 * Measures whether a STANDARD (never Pro) user can exceed the pinned-conversation limit by relaunching
 * between attempts. No Pro, no backend, no revocation: if this reproduces, the limit is bypassable by
 * anyone who reopens the app.
 */
bothPlatformsIt({
  title: 'PROBE pin limit after relaunch',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: probe,
  allureSuites: { parent: 'Session Pro' },
  allureDescription: 'Probe.',
});

async function probe(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device, contactNames } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_with_contacts({ platform, testInfo });
  });

  const beforeOrder = await getConversationOrder(device);
  // Non-prefix, so the order assertion can actually fail.
  const toPin = contactNames.slice(1, STANDARD_PIN_LIMIT + 1);
  const sixth = contactNames[STANDARD_PIN_LIMIT + 1];

  await test.step('Pin up to the standard limit', async () => {
    for (const name of toPin) {
      await device.pinConversation(name);
      await device.waitForTextElementToBePresent(new PlusButton(device));
    }
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step('CONTROL: the 6th is refused in the same session', async () => {
    await device.pinConversation(sixth);
    await device.checkCTA('pinnedConversations');
    await device.clickOnElementAll(new CTAButtonNegative(device));
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step('CLAIM: after a relaunch the 6th is refused too', async () => {
    await forceStopAndRestart(device);
    await device.pinConversation(sixth);
    // If the count is seeded at 0 and never recomputed, this pin is allowed and no CTA appears.
    await device.checkCTA('pinnedConversations');
    await device.clickOnElementAll(new CTAButtonNegative(device));
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
