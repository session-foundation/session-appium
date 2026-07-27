// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.
// The single source of truth for `sleepFor` (both suites) plus the desktop-only `doForAll`.
import { Page } from '@playwright/test';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const sleepFor = async (ms: number, showLog = false) => {
  if (showLog || ms > 5000) {
    console.info(`sleeping for ${ms}ms...`);

    if (ms > 5000) {
      const chunks = 6;
      const msPerChunk = Math.floor(ms / chunks);
      for (let index = 0; index < chunks; index++) {
        await sleep(msPerChunk);
        console.info(`slept for ${msPerChunk * (index + 1)}/${ms}ms...`);
      }

      return;
    }
  }
  return sleep(ms);
};

export async function doForAll<T>(fn: (window: Page) => Promise<T>, windows: Array<Page>) {
  return Promise.all(
    windows.map(async w => {
      return fn(w);
    })
  );
}
