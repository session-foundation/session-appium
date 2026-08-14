import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { MessageInput, MessageLengthCountdown } from '../../locators/conversation';
import { PlusButton } from '../../locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from '../../locators/start_conversation';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from '../../utils/open_app';
import { observeProGrant } from '../../utils/pro_refresh';

/** The Pro message cap, and how far short of it to stop so the countdown is showing. */
const PRO_MAX_CHARS = 10000;
const COUNTDOWN_AT = 5;

bothPlatformsIt({
  title: 'Pro is discovered on a restored device without opening settings',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proRestoreDiscovery,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A restored subscriber has Pro features available from the synced config alone, without having ' +
    'to visit the Pro settings screen first.',
});

/**
 * Whether a restored subscriber is Pro **before they go looking**.
 *
 * `Pro survives a restore from seed` asserts the same entitlement but reaches it through the Pro
 * settings screen, which refreshes status on arrival — so it passes whether or not the config-driven
 * refresh works, and cannot see that path breaking. This spec deliberately never opens settings on the
 * restored device.
 *
 * The composer's character countdown is the observable because it is computed from the client's own
 * Pro state with no navigation and no second party: a client that believes it is not Pro caps at 2000,
 * so a countdown reading against the Pro cap can only come from a status the client actually holds.
 */
async function proRestoreDiscovery(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo, IOS_PRO_CONTEXT);

  const alice = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await newUser(device1, USERNAME.ALICE);
  });

  await test.step('Alice subscribes, and her first device records it', async () => {
    await makeAccountPro({ user: alice, platform });
    // On device1 only: this is what writes the access expiry into config, which is the state the
    // restore then has to carry. Doing the same on device2 would be testing the wrong thing.
    await observeProGrant(device1);
  });

  await test.step('Restore onto a device that has never seen the grant', async () => {
    await device2.restoreFromSeed(alice.recoveryPhrase);
    await device2.dismissCTA();
  });

  await test.step('Verify Pro is available without visiting settings', async () => {
    // Note to Self rather than a contact: the restored account is Alice's own, so there is no second
    // party to message, and the cap applies the same way.
    await device2.clickOnElementAll(new PlusButton(device2));
    await device2.clickOnElementAll(new NewMessageOption(device2));
    await device2.inputText(alice.accountID, new EnterAccountID(device2));
    // The keyboard covers Next on smaller screens. Do NOT swipe here: this is a bottom sheet, so a
    // scroll drags the sheet and the tap silently misses.
    await device2.hideKeyboard();
    await device2.clickOnElementAll(new NextButton(device2));

    await device2.inputText(
      'x'.repeat(PRO_MAX_CHARS - COUNTDOWN_AT),
      new MessageInput(device2),
      true
    );
    await device2.waitForTextElementToBePresent(
      new MessageLengthCountdown(device2, String(COUNTDOWN_AT))
    );
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device1, device2);
  });
}
