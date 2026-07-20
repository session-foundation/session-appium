// @ported-from tests/promise_utils.ts
// @port-kind   verbatim
// Kept separate from the mobile `run/test/utils/sleep_for.ts` so the desktop driving
// code matches the desktop suite verbatim.
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
