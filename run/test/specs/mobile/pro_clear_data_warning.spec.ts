import { expect, test, type TestInfo } from '@playwright/test';

import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { tStripped } from '../../../localizer/lib';
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
  ClearDeviceOnlyRadio,
  UserSettings,
} from '../../locators/settings';
import { newUser } from '../../utils/create_account';
import { expectControlCopy } from '../../utils/element_copy';
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
 * **Pro accounts only.** The standard-account copy is a different claim on a screen whose behaviour is
 * changing: both mobile clients used to delete straight from the first Clear press on the device
 * branch, and now confirm for every account as Desktop always has. A control written against the old
 * behaviour would have been a test of something being removed. Desktop's standard device case is
 * already covered incidentally by `clearDataOnWindow` in `linked_device_group.spec.ts`.
 *
 * The cost of leaving it out, so it is a decision rather than an oversight: nothing here separates
 * "shows the Pro copy to Pro users" from "shows the Pro copy to everyone". Worth a control once the
 * mobile behaviour has settled.
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
  const raw = device.isIOS()
    ? ((await device.getAttribute('label', element.ELEMENT)) ?? '')
    : await device.getTextFromElement(element);
  // Collapsed so a `<br/>` compares equal to the single space `tStripped` puts in its place. The same
  // normalisation the harness applies inside its own matchers, and the reason a whole token can be
  // asserted here rather than a run of one.
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Read-then-`toContain` rather than a locator `text` filter: the mobile filter is an EXACT match, and
 * this asserts one token inside a body that also carries the heading-adjacent copy.
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
  isPro = true
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
    // The row's id is a hand-written tag rather than its display string, so unlike the dialog buttons
    // the lookup says nothing about the copy - which is the case the rule exists for.
    await expectControlCopy(
      device,
      new ClearDataMenuItem(device).build(),
      tStripped('sessionClearData')
    );
    await device.clickOnElementAll(new ClearDataMenuItem(device));
    // The generic first-stage copy, so the assertion after Clear is a CHANGE of copy rather than
    // whatever happened to render first. This token has no break in it, so it matches whole.
    await device.waitForTextElementToBePresent({
      ...new ClearDataDialogDescription(device).build(),
      text: tStripped('clearDataAllDescription'),
      maxWait: PRESENT_MAX_WAIT,
    });
    // Both radios, not just the one a case goes on to tap: which branch the dialog offers is part of
    // what this screen promises, and the preselected one is never pressed so nothing else reads it.
    await expectControlCopy(
      device,
      new ClearDeviceOnlyRadio(device).build(),
      tStripped('clearDeviceOnly')
    );
    await expectControlCopy(
      device,
      new ClearDeviceAndNetworkRadio(device).build(),
      tStripped('clearDeviceAndNetwork')
    );
  });

  return device;
}

/**
 * Cancel out of the confirmation and assert the dialog is gone, having deleted nothing.
 *
 * The button is asserted by id AND copy before being pressed - see `expectControlCopy`. On a destructive flow
 * that matters more than usual: an id-only lookup would keep passing if the two actions ever swapped
 * their labels, and this spec would then be pressing Clear while believing it pressed Cancel.
 */
async function cancelClearData(device: DeviceWrapper): Promise<void> {
  await test.step('Cancel without deleting anything', async () => {
    await expectControlCopy(device, new ClearDataCancelButton(device).build(), tStripped('cancel'));
    await device.clickOnElementAll(new ClearDataCancelButton(device));
    await device.verifyElementNotPresent({
      ...new ModalHeading(device).build(),
      text: tStripped('clearDataAll'),
      maxWait: PRESENT_MAX_WAIT,
    });
  });
}

/**
 * Assert the destructive action carries the copy it should, then press it.
 *
 * Same reasoning as `cancelClearData`: the id alone would not notice this button being relabelled.
 */
async function pressClear(device: DeviceWrapper): Promise<void> {
  await expectControlCopy(device, new ClearDataConfirmButton(device).build(), tStripped('clear'));
  await device.clickOnElementAll(new ClearDataConfirmButton(device));
}

async function proClearDataDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openClearDataDialog(platform, testInfo);

  await test.step('Verify the Pro transfer warning', async () => {
    // Device-only is preselected on both platforms, so no radio is touched here.
    await pressClear(device);
    // Both runs, because neither alone identifies this case: the warning is word-for-word identical in
    // the network token, and the opening question says nothing about Pro.
    await expectDialogBodyContains(device, tStripped('proClearAllDataDevice'));
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
  const device = await openClearDataDialog(platform, testInfo);

  await test.step('Verify the Pro transfer warning on the network branch', async () => {
    // Copy already asserted for both radios in `openClearDataDialog`.
    await device.clickOnElementAll(new ClearDeviceAndNetworkRadio(device));
    await pressClear(device);
    // The opening run here is word-for-word `clearDeviceAndNetworkConfirm` - the standard copy - so it
    // says which branch and nothing about Pro. The warning is what says Pro.
    await expectDialogBodyContains(device, tStripped('proClearAllDataNetwork'));
  });

  await cancelClearData(device);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * The control, and the thing that keeps the two above honest: without it nothing separates "shows the
 * Pro copy to Pro users" from "shows the Pro copy to everyone".
 *
 * Device branch specifically, because that is the one the clients just changed. A standard account
 * pressing Clear here used to have its data deleted on that press - Android's
 * `SettingsViewModel.clearData` fell through to `clearDataDeviceOnly()`, iOS's `clearDeviceOnly()` to
 * `clearLocalAccount()` - so this case could not exist. It confirms for every account now, and this is
 * what stops that regressing back to a one-tap wipe.
 */
bothPlatformsIt({
  title: 'Clear data confirmation for a standard account (device)',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: standardClearDataDevice,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A standard account clearing its device is asked to confirm, and told nothing about Pro.',
});

async function standardClearDataDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openClearDataDialog(platform, testInfo, false);

  await test.step('Verify the standard confirmation says nothing about Pro', async () => {
    await pressClear(device);
    const body = await readDialogBody(device);
    expect(body).toContain(tStripped('clearDeviceDescription'));
    // Reaching this line at all is the enforcement: before the client change the press above deleted
    // the account, and the dialog this reads would not have been on screen.
    expect(body).not.toContain(tStripped('proClearAllDataDevice'));
  });

  await cancelClearData(device);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * The fourth cell. Each of the four carries its OWN token, so this is the only thing asserting the
 * copy that warns a standard account its messages cannot be restored.
 */
bothPlatformsIt({
  title: 'Clear data confirmation for a standard account (network)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: standardClearDataNetwork,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A standard account clearing the network is warned its data cannot be restored, and told nothing ' +
    'about Pro.',
});

async function standardClearDataNetwork(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openClearDataDialog(platform, testInfo, false);

  await test.step('Verify the standard network confirmation says nothing about Pro', async () => {
    await device.clickOnElementAll(new ClearDeviceAndNetworkRadio(device));
    await pressClear(device);
    const body = await readDialogBody(device);
    expect(body).toContain(tStripped('clearDeviceAndNetworkConfirm'));
    expect(body).not.toContain(tStripped('proClearAllDataNetwork'));
  });

  await cancelClearData(device);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
