// Import paths rewritten for run/desktop/. Also hardened: close() failures are swallowed,
// the comment expanded, and tracked pids are reset after killing
import { Page } from '@playwright/test';
import { execSync } from 'child_process';

import { sleepFor } from '../shared/promise_utils';
import { getTrackedElectronPids, resetTrackedElectronPids } from './open';

export const forceCloseAllWindows = async (windows: Array<Page>) => {
  await Promise.race([Promise.all(windows.map(w => w.close().catch(() => {}))), sleepFor(4000)]);

  // Also kill child processes. When a test closes a window on purpose, the
  // restarted app becomes a child of the original electronApp that Playwright no
  // longer tracks, so we kill every tracked pid's whole process tree.
  const pids = getTrackedElectronPids();
  pids.forEach(pid => {
    try {
      const killCommand =
        process.platform === 'win32'
          ? `taskkill /F /T /PID ${pid}` // /T kills child processes on Windows
          : `pkill -9 -P ${pid}; kill -9 ${pid}`; // Kill children then parent on Unix
      execSync(killCommand, { stdio: 'ignore' });
    } catch (_e) {
      // This is fine - process already dead or doesn't exist
    }
  });

  // Clear the tracked pids now that they've all been killed, so a subsequent
  // app launch in the same worker starts from an empty list instead of
  // re-attempting to kill these (already-dead) pids on every later teardown.
  resetTrackedElectronPids();
};
