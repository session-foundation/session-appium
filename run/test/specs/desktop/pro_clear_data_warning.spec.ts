import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { Global, LeftPane, Settings } from '../../../desktop/locators';
import { test_Alice_1W_no_network } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';
import { localizedRun } from '../../../shared/localized_runs';

/**
 * The warning before wiping an account: Pro does not transfer, so save the recovery password.
 *
 * `DeleteAccountModal` is one modal in two stages. The first shows `clearDataAllDescription` and the
 * two radios; pressing Clear flips `askingConfirmation` and the same `modal-description` slot
 * re-renders with the confirmation copy. Only a second press deletes anything, so every case here
 * reads the copy and cancels.
 *
 * Both branches, both account states, because the app picks from a **two-by-two** - `deleteMode`
 * crossed with `useCurrentUserHasPro()` - and each cell has its own token.
 *
 * Each Pro case asserts **two** runs, and needs both. The Pro warning is word-for-word identical in the
 * two tokens, so on its own it cannot say which branch rendered; and the network branch's opening
 * sentence is word-for-word `clearDeviceAndNetworkConfirm`, the standard copy, so on its own it cannot
 * say the account was Pro. Only the pair pins one cell of the grid.
 *
 * Desktop only carries all four: iOS tags nothing in this flow, and Android's radios have no `qaTag`,
 * so mobile reaches only the device branch (`mobile/pro_clear_data_warning.spec.ts`).
 *
 * Display mocks throughout - the copy is chosen from `useCurrentUserHasPro()`, which a mocked status
 * and proof satisfy, and nothing here needs a proof another party would verify.
 */

const PRESENT_MAX_WAIT = 10_000;

/**
 * The shared second half of both Pro tokens. Run 1, not the whole string: `tStripped` renders the
 * `<br/><br/>` between the halves as a space that is in no client's DOM - see `localizedRuns`.
 */
const PRO_TRANSFER_WARNING = localizedRun('proClearAllDataDevice', 1);

const PRO_ACCOUNT = {
  pro: { proBackendStatus: 'active', proProof: 'valid', proLoadingState: 'success' },
} as const;

/** No `pro` block at all: a standard account, which is the other half of every assertion below. */
const STANDARD_ACCOUNT = undefined;

async function openClearDataModal(alice: DesktopWrapper): Promise<void> {
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.clearDataMenuItem);
  // The generic first-stage copy, so the assertion after Clear is a CHANGE of copy rather than
  // whatever happened to render first.
  await alice.waitForElement({
    locator: Global.modalDescription,
    options: { maxWaitMs: PRESENT_MAX_WAIT, text: tStripped('clearDataAllDescription') },
  });
}

/**
 * Advance to the confirmation stage, assert every run given, then cancel.
 *
 * The cancel is not tidying up: it is the assertion that this test never took the destructive action.
 */
async function expectConfirmationCopy(alice: DesktopWrapper, runs: Array<string>): Promise<void> {
  await alice.clickOn(Global.confirmButton);
  for (const run of runs) {
    await alice.waitForElement({
      locator: Global.modalDescription,
      options: { maxWaitMs: PRESENT_MAX_WAIT, text: run },
    });
  }
  await alice.clickOn(Global.cancelButton);
  await alice.hasElementPoppedUpThatShouldnt(Global.modalDescription);
}

test_Alice_1W_no_network(
  'Clear data warns a Pro subscriber (device)',
  async ({ alice }) => {
    await openClearDataModal(alice);
    // Device-only is the modal's initial `deleteMode`, so no radio is touched here.
    await expectConfirmationCopy(alice, [
      localizedRun('proClearAllDataDevice', 0),
      PRO_TRANSFER_WARNING,
    ]);
  },
  PRO_ACCOUNT
);

test_Alice_1W_no_network(
  'Clear data warns a Pro subscriber (network)',
  async ({ alice }) => {
    await openClearDataModal(alice);
    await alice.clickOn(Settings.clearDeviceAndNetworkRadial);
    await expectConfirmationCopy(alice, [
      localizedRun('proClearAllDataNetwork', 0),
      PRO_TRANSFER_WARNING,
    ]);
  },
  PRO_ACCOUNT
);

/**
 * The controls. Same two branches on a standard account, which must get the ordinary copy and **not**
 * the transfer warning - this is what makes the two above about *Pro* rather than about the
 * confirmation stage existing at all.
 */
test_Alice_1W_no_network(
  'Clear data confirmation for a standard account (device)',
  async ({ alice }) => {
    await openClearDataModal(alice);
    await alice.clickOn(Global.confirmButton);
    await alice.waitForElement({
      locator: Global.modalDescription,
      options: { maxWaitMs: PRESENT_MAX_WAIT, text: tStripped('clearDeviceDescription') },
    });
    await expectProWarningAbsent(alice);
  },
  STANDARD_ACCOUNT
);

test_Alice_1W_no_network(
  'Clear data confirmation for a standard account (network)',
  async ({ alice }) => {
    await openClearDataModal(alice);
    await alice.clickOn(Settings.clearDeviceAndNetworkRadial);
    await alice.clickOn(Global.confirmButton);
    await alice.waitForElement({
      locator: Global.modalDescription,
      options: { maxWaitMs: PRESENT_MAX_WAIT, text: tStripped('clearDeviceAndNetworkConfirm') },
    });
    await expectProWarningAbsent(alice);
  },
  STANDARD_ACCOUNT
);

/** Assert the transfer warning is not on the confirmation, then cancel out of it. */
async function expectProWarningAbsent(alice: DesktopWrapper): Promise<void> {
  await alice.hasElementPoppedUpThatShouldnt(Global.modalDescription, PRO_TRANSFER_WARNING);
  await alice.clickOn(Global.cancelButton);
}
