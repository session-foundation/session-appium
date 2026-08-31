import { DeviceWrapper } from '../../types/DeviceWrapper';
import { PathMenuItem } from '../locators/settings';

/**
 * Confirm Settings is on screen, then leave it for the home screen.
 *
 * The wait is the point. A back issued while the previous screen's transition is still running is
 * swallowed, and the app is left sitting on Settings — which reads as the review prompt failing to
 * appear, because the prompt only ever renders over the home screen. The failure then names a missing
 * modal and points nowhere near the navigation that did not finish.
 *
 * There is deliberately no matching check that Settings has GONE afterwards. `PathMenuItem` is a
 * `scrollIntoView` selector on Android, so polling for its absence scrolls whatever list is on screen,
 * and its 5s default is smaller than a few of those queries — an absence check built on it fails on a
 * screen it was never looking at. The assertion that follows in each caller is the real destination
 * check.
 */
export async function returnHomeFromSettings(device: DeviceWrapper): Promise<void> {
  await device.waitForTextElementToBePresent(new PathMenuItem(device));
  await device.back();
}

/**
 * Walk back from the Path screen to the home screen, which is what arms the review prompt's Path
 * trigger.
 */
export async function returnHomeFromPath(device: DeviceWrapper): Promise<void> {
  await device.back();
  await returnHomeFromSettings(device);
}
