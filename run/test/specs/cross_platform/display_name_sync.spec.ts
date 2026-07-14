import { crossPlatformTest } from '../../utils/cross_platform';

/**
 * Cross-platform display-name sync (v1: Android + Desktop). A backend-free smoke
 * test of the cross-platform harness: an Android device and a Desktop client are
 * linked to one account, one changes the display name, and the other must reflect
 * it. Both clients must be on the SAME Session network for the account to sync.
 */

const NEW_NAME = 'Alice in chains';

crossPlatformTest({
  title: 'Display name change syncs (Android changes, Desktop sees)',
  risk: 'medium',
  setup: { android: 1, desktop: 1 },
  allureSuites: { parent: 'User Actions', suite: 'Change Username' },
  allureDescription: 'Android changes its display name; a linked Desktop client reflects it.',
  testCb: async ({ android, desktop }) => {
    await android[0].changeDisplayName(NEW_NAME);
    await desktop[0].assertDisplayName(NEW_NAME);
  },
});

crossPlatformTest({
  title: 'Display name change syncs (Desktop changes, Android sees)',
  risk: 'medium',
  setup: { android: 1, desktop: 1 },
  allureSuites: { parent: 'User Actions', suite: 'Change Username' },
  allureDescription: 'Desktop changes its display name; a linked Android client reflects it.',
  testCb: async ({ android, desktop }) => {
    await desktop[0].changeDisplayName(NEW_NAME);
    await android[0].assertDisplayName(NEW_NAME);
  },
});
