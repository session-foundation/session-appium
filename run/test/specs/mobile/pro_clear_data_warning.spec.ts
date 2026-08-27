import { expect, test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { tStripped } from '../../../localizer/lib';
import { localizedRun } from '../../../shared/localized_runs';
import { TestSteps } from '../../../types/allure';
import { androidIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { ModalDescription, ModalHeading } from '../../locators/global';
import {
  ClearDataCancelButton,
  ClearDataConfirmButton,
  ClearDataMenuItem,
  UserSettings,
} from '../../locators/settings';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { activeProContext } from '../../utils/pro_context';

const PRESENT_MAX_WAIT = 10_000;
const ABSENT_MAX_WAIT = 1_000;

/**
 * The warning a Pro subscriber gets before wiping their account: Pro does not transfer, so save the
 * recovery password first.
 *
 * It is a **second-stage** dialog. Opening "Clear Data" shows the generic copy and the two radios;
 * pressing Clear re-renders the same dialog with `proClearAllDataDevice` in place of the generic body,
 * and only a further press deletes anything. So this reads the copy and cancels - the destructive
 * action is never taken.
 *
 * **Android only, and only the device branch.** Two separate gaps, both on the clients:
 *
 * - iOS carries no test identifier anywhere in this flow - not on the settings row, the `NukeDataModal`,
 *   its radios, its buttons, nor the `ConfirmationModal` holding the copy.
 * - Android's two radios are `RadioOption`s built with no `qaTag`, so the network branch cannot be
 *   selected. Device-only is the default selection, which is the only reason this half is reachable.
 *
 * Desktop covers all four cells (`desktop/pro_clear_data_warning.spec.ts`) because its modal is fully
 * tagged.
 */
androidIt({
  title: 'Clear data warns a Pro subscriber (device)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proClearDataDeviceWarning,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A Pro subscriber clearing their device is told Pro cannot be transferred and to save their ' +
    'recovery password first.',
});

/**
 * Read the dialog body and assert it contains `run`.
 *
 * Read-then-`toContain` rather than a locator `text` filter, for the same reason the refund specs read
 * the Open URL dialog: the mobile filter is an EXACT match after normalisation. The copy here spans a
 * `<br/><br/>`, so no single run of it is ever the whole element text - see `localizedRuns`.
 */
async function expectDialogBodyContains(device: DeviceWrapper, run: string): Promise<void> {
  const element = await device.waitForTextElementToBePresent({
    ...new ModalDescription(device).build(),
    maxWait: PRESENT_MAX_WAIT,
  });
  expect(await device.getTextFromElement(element)).toContain(run);
}

/**
 * Bring the "Clear Data" row into view. It is the last row of the settings list, so on arrival it is
 * off screen and therefore absent from the accessibility tree - which reads as "element not found"
 * rather than "not scrolled to".
 */
async function scrollToClearDataRow(device: DeviceWrapper): Promise<void> {
  const maxScrolls = 6;
  for (let i = 0; i < maxScrolls; i++) {
    const found = await device.doesElementExist({
      ...new ClearDataMenuItem(device).build(),
      maxWait: ABSENT_MAX_WAIT,
    });
    if (found) {
      return;
    }
    await device.scrollDown();
  }
  await device.waitForTextElementToBePresent({
    ...new ClearDataMenuItem(device).build(),
    maxWait: PRESENT_MAX_WAIT,
  });
}

async function proClearDataDeviceWarning(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, activeProContext());
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step('Open the clear-data dialog', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await scrollToClearDataRow(device);
    await device.clickOnElementAll(new ClearDataMenuItem(device));
    // The generic body, which every account sees and which the Pro copy replaces. Asserted so the step
    // below is a change of copy rather than the first thing that happened to render. This token has no
    // break in it, so it can be matched whole.
    await device.waitForTextElementToBePresent({
      ...new ModalDescription(device).build(),
      text: tStripped('clearDataAllDescription'),
      maxWait: PRESENT_MAX_WAIT,
    });
  });

  await test.step('Verify the Pro transfer warning', async () => {
    // Safe to press only because this account is Pro. A standard account with device-only selected has
    // no second confirmation - `SettingsViewModel` calls `clearDataDeviceOnly()` straight from here - so
    // the same tap would wipe the app. That is why there is no standard-account control on Android.
    await device.clickOnElementAll(new ClearDataConfirmButton(device));
    // Both runs. The warning alone is shared word-for-word with the network token, so it cannot say
    // which branch rendered; the opening question alone appears on no other token here but says nothing
    // about Pro.
    await expectDialogBodyContains(device, localizedRun('proClearAllDataDevice', 0));
    await expectDialogBodyContains(device, localizedRun('proClearAllDataDevice', 1));
    // The title is unchanged across both stages, so this says the dialog is still the clear-data one
    // rather than something else having taken over the screen.
    await device.waitForTextElementToBePresent({
      ...new ModalHeading(device).build(),
      text: tStripped('clearDataAll'),
      maxWait: PRESENT_MAX_WAIT,
    });
  });

  await test.step('Cancel without deleting anything', async () => {
    await device.clickOnElementAll(new ClearDataCancelButton(device));
    await device.verifyElementNotPresent({
      ...new ModalHeading(device).build(),
      text: tStripped('clearDataAll'),
      maxWait: PRESENT_MAX_WAIT,
    });
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
