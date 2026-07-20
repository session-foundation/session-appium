// @ported-from tests/automation/utilities/linked_device.ts
// @port-kind   verbatim
import { openAppsAndWaitWindows } from './open';
import { recoverFromSeed } from './recovery_using_seed';
import { checkPathLight } from './utils';

export async function linkedDevice(recoveryPhrase: string) {
  const [window] = await openAppsAndWaitWindows(1); // not using sessionTest here as we need to close and reopen one of the window

  await recoverFromSeed(window, recoveryPhrase);
  await checkPathLight(window);

  return window;
}
