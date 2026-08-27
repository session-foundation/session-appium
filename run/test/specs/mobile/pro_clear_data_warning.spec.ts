import { expect, test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { tStripped } from '../../../localizer/lib';
import { localizedRun } from '../../../shared/localized_runs';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { ModalDescription, ModalHeading } from '../../locators/global';
import {
  ClearDataCancelButton,
  ClearDataConfirmButton,
  ClearDataDialogDescription,
  ClearDataMenuItem,
  ClearDeviceAndNetworkRadio,
  UserSettings,
} from '../../locators/settings';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { activeProContext, PRO_BACKEND_CONTEXT } from '../../utils/pro_context';

const PRESENT_MAX_WAIT = 10_000;
const ABSENT_MAX_WAIT = 1_000;

/**
 * The warning before wiping an account: Pro does not transfer, so save the recovery password.
 *
 * A **two-stage** dialog on both platforms. Opening Clear Data shows the generic copy and the two
 * radios; pressing Clear re-renders with the confirmation copy, and only a further press deletes
 * anything. Every case here reads the copy and cancels - the destructive action is never taken.
 *
 * The two stages are built differently, and it matters for the locators. Android swaps the one
 * dialog's `ClearDataState`, so both stages are the same element. iOS presents a `ConfirmationModal`
 * OVER `NukeDataModal` rather than replacing it, so both are in the accessibility tree at once - which
 * is why the first stage has its own ids there (`ClearDataDialogDescription`,
 * `ClearDataConfirmButton`) and only the confirmation answers to `ModalDescription`.
 *
 * **There is no standard-account control on the device branch, and there cannot be.** Both clients
 * delete immediately from the first Clear press when a standard account has device-only selected -
 * Android calls `clearDataDeviceOnly()`, iOS calls `clearLocalAccount()` - with no confirmation to
 * assert. The control below therefore uses the network branch, which does confirm for everyone.
 */

bothPlatformsIt({
  title: 'Clear data warns a Pro subscriber (device)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proClearDataDevice,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A Pro subscriber clearing their device is told Pro cannot be transferred and to save their ' +
    'recovery password first.',
});

bothPlatformsIt({
  title: 'Clear data warns a Pro subscriber (network)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proClearDataNetwork,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'The same warning on the network branch, which additionally says the data cannot be restored.',
});

bothPlatformsIt({
  title: 'Clear data confirmation for a standard account (network)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: standardClearDataNetwork,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'The control: a standard account gets the ordinary confirmation and no mention of Pro.',
});

/**
 * Read the dialog body.
 *
 * Per-platform for the reason `readOpenUrlDialogCopy` gives: the identifier takes over an iOS element's
 * `name`, so its copy is only reachable on `label`, while Android exposes it as `text`.
 */
async function readDialogBody(device: DeviceWrapper): Promise<string> {
  const element = await device.waitForTextElementToBePresent({
    ...new ModalDescription(device).build(),
    maxWait: PRESENT_MAX_WAIT,
  });
  if (device.isIOS()) {
    return (await device.getAttribute('label', element.ELEMENT)) ?? '';
  }
  return device.getTextFromElement(element);
}

/**
 * Read-then-`toContain` rather than a locator `text` filter, because the mobile filter is an EXACT
 * match after normalisation and this copy spans a `<br/><br/>` - so no run of it is ever the whole
 * element text. See `localizedRuns`.
 */
async function expectDialogBodyContains(device: DeviceWrapper, run: string): Promise<void> {
  expect(await readDialogBody(device)).toContain(run);
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

async function openClearDataDialog(
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  isPro: boolean
): Promise<DeviceWrapper> {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(
      platform,
      testInfo,
      isPro ? activeProContext() : PRO_BACKEND_CONTEXT
    );
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step('Open the clear-data dialog', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await scrollToClearDataRow(device);
    await device.clickOnElementAll(new ClearDataMenuItem(device));
    // The generic first-stage copy, so the assertion after Clear is a CHANGE of copy rather than
    // whatever happened to render first. This token has no break in it, so it matches whole.
    await device.waitForTextElementToBePresent({
      ...new ClearDataDialogDescription(device).build(),
      text: tStripped('clearDataAllDescription'),
      maxWait: PRESENT_MAX_WAIT,
    });
  });

  return device;
}

/** Cancel out of the confirmation and assert the dialog is gone, having deleted nothing. */
async function cancelClearData(device: DeviceWrapper): Promise<void> {
  await test.step('Cancel without deleting anything', async () => {
    await device.clickOnElementAll(new ClearDataCancelButton(device));
    await device.verifyElementNotPresent({
      ...new ModalHeading(device).build(),
      text: tStripped('clearDataAll'),
      maxWait: PRESENT_MAX_WAIT,
    });
  });
}

async function proClearDataDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openClearDataDialog(platform, testInfo, true);

  await test.step('Verify the Pro transfer warning', async () => {
    // Device-only is preselected on both platforms, so no radio is touched here.
    await device.clickOnElementAll(new ClearDataConfirmButton(device));
    // Both runs, because neither alone identifies this case: the warning is word-for-word identical in
    // the network token, and the opening question says nothing about Pro.
    await expectDialogBodyContains(device, localizedRun('proClearAllDataDevice', 0));
    await expectDialogBodyContains(device, localizedRun('proClearAllDataDevice', 1));
    await device.waitForTextElementToBePresent({
      ...new ModalHeading(device).build(),
      text: tStripped('clearDataAll'),
      maxWait: PRESENT_MAX_WAIT,
    });
  });

  await cancelClearData(device);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proClearDataNetwork(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openClearDataDialog(platform, testInfo, true);

  await test.step('Verify the Pro transfer warning on the network branch', async () => {
    await device.clickOnElementAll(new ClearDeviceAndNetworkRadio(device));
    await device.clickOnElementAll(new ClearDataConfirmButton(device));
    // The opening run here is word-for-word `clearDeviceAndNetworkConfirm` - the standard copy - so it
    // says which branch and nothing about Pro. The warning is what says Pro.
    await expectDialogBodyContains(device, localizedRun('proClearAllDataNetwork', 0));
    await expectDialogBodyContains(device, localizedRun('proClearAllDataNetwork', 1));
  });

  await cancelClearData(device);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function standardClearDataNetwork(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openClearDataDialog(platform, testInfo, false);

  await test.step('Verify the standard confirmation says nothing about Pro', async () => {
    await device.clickOnElementAll(new ClearDeviceAndNetworkRadio(device));
    await device.clickOnElementAll(new ClearDataConfirmButton(device));
    const body = await readDialogBody(device);
    expect(body).toContain(tStripped('clearDeviceAndNetworkConfirm'));
    // The absence is the assertion this test exists for: it is what makes the two Pro cases about Pro
    // rather than about the confirmation stage existing at all.
    expect(body).not.toContain(localizedRun('proClearAllDataNetwork', 1));
  });

  await cancelClearData(device);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
