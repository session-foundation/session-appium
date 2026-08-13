import type { TestContext } from './open';

import { DesktopWrapper } from './DesktopWrapper';
import { relaunchApp, waitFirstWindow } from './open';

/**
 * Restart a window on the same account, keeping the wrapper usable.
 *
 * Needed because Session Desktop asks the Pro backend for status **once, at startup**: a grant made
 * while the app is running is invisible until it comes back up, exactly as on mobile
 * (`forceStopAndRestart`). The Pro settings page only refetches around an expiry crossing, so
 * reopening it is not a substitute.
 *
 * Lives here rather than on `DesktopWrapper` to keep the invariant that the wrapper never launches or
 * kills Electron — process lifecycle stays with the test-template layer.
 */
export async function restartApp(wrapper: DesktopWrapper, context?: TestContext): Promise<void> {
  const { multi, nodeAppInstance } = wrapper.getLaunchIdentity();
  await wrapper
    .getPage()
    .close()
    .catch(() => undefined);
  const app = await relaunchApp(multi, nodeAppInstance, context);
  wrapper.setPage(await waitFirstWindow(app));
}
