import { test } from '@playwright/test';

import type { IBaseDeviceWrapper } from '../../types/IBaseDeviceWrapper';

import { DesktopWrapper } from '../../desktop/DesktopWrapper';
import { restartApp } from '../../desktop/restart';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { forceStopAndRestart } from './utilities';

/**
 * Actions a cross-platform spec performs on a client whose platform it does not care about.
 *
 * Everything here dispatches on the concrete wrapper because the two platforms genuinely differ in
 * mechanism rather than in naming — which is why these are functions here instead of methods on
 * `IBaseDeviceWrapper`. Anything both platforms can express under one signature belongs on the
 * interface instead.
 */

/**
 * Bring a client back up on the same account.
 *
 * Needed for Session Pro above all: **all three clients read their Pro status once, at startup**, so a
 * grant minted while the app is running is invisible until it restarts. That is per-client — a linked
 * device receives the proof through config sync and needs no restart, which is what makes
 * `sendLongProMessage` a meaningful sync assertion.
 *
 * `pro` is not cosmetic on Desktop: a window's launch context is re-applied on every launch, and
 * `applyProMocks` clears every Pro variable it owns each time — so a restart with no context brings
 * the window back up with Pro switched *off*, on a test that just granted it.
 */
export async function restartClient(
  client: IBaseDeviceWrapper,
  { pro = false }: { pro?: boolean } = {}
): Promise<void> {
  await test.step(`Restart ${client.getDeviceIdentity()}`, async () => {
    if (client instanceof DesktopWrapper) {
      await restartApp(client, pro ? { pro: {} } : undefined);
      return;
    }
    if (client instanceof DeviceWrapper) {
      await forceStopAndRestart(client);
      // A fresh launch lands on whatever CTA the app wants to show (the donation appeal, the Pro
      // upsell). Left up it swallows the next tap, several steps from anything that mentions a CTA.
      await client.dismissCTA();
      return;
    }
    throw new Error(
      `restartClient: ${client.getDeviceIdentity()} is neither a mobile nor a desktop client, so ` +
        `there is no way to relaunch it.`
    );
  });
}
