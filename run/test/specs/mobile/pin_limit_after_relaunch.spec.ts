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
 * The pinned-conversation limit across a relaunch.
 *
 * Every other pin spec pins and asserts inside one session, where the count is live because each pin
 * updates it. This one restarts in between, which is the case where a client rebuilding that count from
 * scratch reads zero and lets a standard user past the limit — repeatably, so the boundary can be
 * crossed by anyone who reopens the app.
 *
 * No Pro, no backend, no revocation: the limit applies to a standard account, and involving Pro would
 * only add ways for the spec to fail for reasons other than the one it is about.
 *
 * The in-session refusal is asserted first. Without it the relaunch assertion proves nothing — a client
 * that refused every pin, or that never pinned at all, would satisfy it.
 */
bothPlatformsIt({
  title: 'The pinned conversation limit holds across a relaunch',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: pinLimitAfterRelaunch,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A standard user is refused a sixth pinned conversation, and is still refused after restarting the ' +
    'app.',
});

async function pinLimitAfterRelaunch(platform: SupportedPlatformsType, testInfo: TestInfo) {
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

  await test.step('The 6th is refused in the same session', async () => {
    await device.pinConversation(sixth);
    await device.checkCTA('pinnedConversations');
    await device.clickOnElementAll(new CTAButtonNegative(device));
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step('The 6th is refused after a relaunch too', async () => {
    await forceStopAndRestart(device);
    await device.pinConversation(sixth);
    // A client that rebuilds the pinned count only when a pin changes reads zero here, allows the pin,
    // and raises no CTA — the limit silently not applying rather than applying wrongly.
    await device.checkCTA('pinnedConversations');
    await device.clickOnElementAll(new CTAButtonNegative(device));
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
