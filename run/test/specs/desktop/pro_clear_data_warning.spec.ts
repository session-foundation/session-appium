import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { Global, LeftPane, Settings } from '../../../desktop/locators';
import { test_Alice_1W_no_network } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

/**
 * The warning before wiping an account: Pro does not transfer, so save the recovery password.
 *
 * `DeleteAccountModal` is one modal in two stages. The first shows `clearDataAllDescription` and the
 * two radios; pressing Clear flips `askingConfirmation` and the same slot re-renders with the
 * confirmation copy. Only a second press deletes anything, so every case here reads the copy and
 * cancels - the destructive action is never taken.
 *
 * Both branches, because the app picks the copy from `deleteMode` crossed with
 * `useCurrentUserHasPro()` and each cell has its own token.
 *
 * The standard-account case is the control: without it nothing separates "shows the Pro copy to Pro
 * users" from "shows the Pro copy to everyone". Only the device branch, matching the mobile spec -
 * that is the one the mobile clients just changed, and the same `useCurrentUserHasPro()` drives both
 * branches, so a second control would pin nothing new.
 *
 * Display mocks throughout - the copy is chosen from `useCurrentUserHasPro()`, which a mocked status
 * and proof satisfy, and nothing here needs a proof another party would verify.
 *
 * **Unlike the mobile spec, this asserts whole tokens rather than runs of them.** `checkModalStrings`
 * reads `innerText`, where a `<br/>` renders as a newline, and then collapses whitespace - which lands
 * on exactly what `tStripped` produces for the same token. The `<br/>`-spanning problem that forces
 * `localizedRuns` on mobile does not exist here, so importing it would be carrying a workaround for
 * another platform's constraint.
 */

const PRO_ACCOUNT = {
  pro: { proBackendStatus: 'active', proProof: 'valid', proLoadingState: 'success' },
} as const;

/**
 * Open the modal and assert it is on its first stage.
 *
 * `checkModalStrings` rather than a bare `modal-description` wait: it scopes to
 * `[data-modal-id="deleteAccountModal"]`, so a second modal carrying the generic description slot
 * cannot satisfy it, and it pins the heading at the same time.
 */
async function openClearDataModal(alice: DesktopWrapper): Promise<void> {
  await alice.clickOn(LeftPane.settingsButton);
  // Id AND copy, here and on every control below - see the rule in CLAUDE.md. `clickOnWithText` is the
  // desktop primitive for it.
  await alice.clickOnWithText(Settings.clearDataMenuItem, tStripped('sessionClearData'));
  // The generic first-stage copy, so the assertion after Clear is a CHANGE of copy rather than
  // whatever happened to render first.
  await alice.checkModalStrings(
    tStripped('clearDataAll'),
    tStripped('clearDataAllDescription'),
    'deleteAccountModal'
  );
}

/**
 * Advance to the confirmation stage, assert its copy, then cancel.
 *
 * The cancel is not tidying up: it is the assertion that this test never took the destructive action.
 */
async function expectConfirmationCopy(alice: DesktopWrapper, expected: string): Promise<void> {
  await alice.clickOnWithText(Global.confirmButton, tStripped('clear'));
  await alice.checkModalStrings(tStripped('clearDataAll'), expected, 'deleteAccountModal');
  await alice.clickOnWithText(Global.cancelButton, tStripped('cancel'));
  await alice.hasElementPoppedUpThatShouldnt(Global.modalDescription);
}

test_Alice_1W_no_network(
  'Clear data warns a Pro subscriber (device)',
  async ({ alice }) => {
    await openClearDataModal(alice);
    // Device-only is the modal's initial `deleteMode`, so no radio is touched here.
    await expectConfirmationCopy(alice, tStripped('proClearAllDataDevice'));
  },
  PRO_ACCOUNT
);

test_Alice_1W_no_network(
  'Clear data warns a Pro subscriber (network)',
  async ({ alice }) => {
    await openClearDataModal(alice);
    await alice.clickOnWithText(
      Settings.clearDeviceAndNetworkRadial,
      tStripped('clearDeviceAndNetwork')
    );
    await expectConfirmationCopy(alice, tStripped('proClearAllDataNetwork'));
  },
  PRO_ACCOUNT
);

/**
 * The control, and the thing that keeps the two above honest: without it nothing separates "shows the
 * Pro copy to Pro users" from "shows the Pro copy to everyone".
 *
 * No `pro` block at all, so `useCurrentUserHasPro()` is false. Desktop has always confirmed here for
 * every account - it is the mobile clients that just changed to match, which is why the mobile spec
 * carries the same case.
 */
test_Alice_1W_no_network(
  'Clear data confirmation for a standard account (device)',
  async ({ alice }) => {
    await openClearDataModal(alice);
    await expectConfirmationCopy(alice, tStripped('clearDeviceDescription'));
  }
);
