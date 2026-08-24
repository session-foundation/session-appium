import { crossPlatformTest } from '../../utils/cross_platform';
import { linkedDevices } from '../../utils/cross_platform_state_builder';

/**
 * Cross-platform display-name sync across ALL THREE clients (Android + iOS + Desktop).
 *
 * The three-platform counterpart to `display_name_sync.spec.ts` (Android + Desktop) and
 * `display_name_sync_ios.spec.ts` (iOS + Desktop), kept deliberately identical in shape so a
 * failure here points at a platform rather than at the scenario.
 *
 * Why this is worth having on top of the two pairwise specs: those verify that a change made on
 * one client reaches ONE other. This verifies it fans out to EVERY linked client from a single
 * write — which is the property users actually rely on, and the one a per-platform config
 * regression breaks without breaking either pairwise test. Each case changes the name on one
 * platform and asserts the other two, so the three cases together cover every originator.
 *
 * All three clients are linked to one seeded account (qa-seeder `1user`, restore-from-seed — no UI
 * onboarding) and must be on the SAME Session network; `resolveNetworkTarget` cross-checks that
 * before the slow seeding step, since each platform learns its network from a different source.
 *
 * Cost note: every case opens one emulator, one simulator and one Electron window, so this file is
 * three full three-platform setups. The pools it needs are 1 iOS simulator and 1 Android emulator
 * (`assertPoolsCanFit` fails fast if the machine has fewer).
 *
 * Assertions run sequentially rather than under `Promise.all`: the observers are independent and
 * could be checked concurrently, but a sequential failure names exactly which client did not
 * receive the update, which is the whole diagnostic value of a three-platform test.
 */

const NEW_NAME = 'Alice in chains';
const NEW_NAME2 = 'Bob in chains';
const NEW_NAME3 = 'Charlie in chains';

crossPlatformTest({
  title: 'Display name change syncs',
  risk: 'medium',
  setup: linkedDevices({ android: 1, ios: 1, desktop: 1 }),
  testCb: async ({ accounts: { alice } }) => {
    await alice.ios[0].changeDisplayName(NEW_NAME);
    await alice.android[0].assertDisplayName(NEW_NAME);
    await alice.desktop[0].assertDisplayName(NEW_NAME);

    await alice.android[0].changeDisplayName(NEW_NAME2);
    await alice.ios[0].assertDisplayName(NEW_NAME2);
    await alice.desktop[0].assertDisplayName(NEW_NAME2);

    await alice.desktop[0].changeDisplayName(NEW_NAME3);
    await alice.android[0].assertDisplayName(NEW_NAME3);
    await alice.ios[0].assertDisplayName(NEW_NAME3);
  },
});
