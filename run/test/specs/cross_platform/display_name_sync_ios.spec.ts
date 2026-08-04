import { crossPlatformTest } from '../../utils/cross_platform';
import { linkedDevices } from '../../utils/cross_platform_state_builder';

/**
 * Cross-platform display-name sync (iOS + Desktop) — the iOS counterpart of
 * `display_name_sync.spec.ts`, deliberately identical in shape so a failure here points at the
 * platform rather than the scenario. An iOS simulator and a Desktop client are linked to one
 * seeded account, one changes the display name, and the other must reflect it. Both clients must
 * be on the SAME Session network (enforced by `resolveNetworkTarget`).
 */

const NEW_NAME = 'Alice in chains';

crossPlatformTest({
  title: 'Display name change syncs (iOS changes, Desktop sees)',
  risk: 'medium',
  setup: linkedDevices({ ios: 1, desktop: 1 }),
  testCb: async ({ accounts: { alice } }) => {
    await alice.ios[0].changeDisplayName(NEW_NAME);
    await alice.desktop[0].assertDisplayName(NEW_NAME);
  },
});

crossPlatformTest({
  title: 'Display name change syncs (Desktop changes, iOS sees)',
  risk: 'medium',
  setup: linkedDevices({ ios: 1, desktop: 1 }),
  testCb: async ({ accounts: { alice } }) => {
    await alice.desktop[0].changeDisplayName(NEW_NAME);
    await alice.ios[0].assertDisplayName(NEW_NAME);
  },
});
