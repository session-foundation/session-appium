import { DesktopWrapper } from './DesktopWrapper';
import { CTA } from './locators';

/**
 * Clear a Pro CTA if one is up, and report whether there was one.
 *
 * Never an assertion. A CTA is raised off the status the client has fetched, so whether it is up at any
 * given moment races that fetch — but left up it covers the screen and swallows the interactions behind
 * it, which surfaces far from the cause.
 */
export async function dismissAnyProCTA(window: DesktopWrapper, waitMs: number): Promise<boolean> {
  const cancel = window
    .getPage()
    .locator(`[${CTA.cancelButton.strategy}="${CTA.cancelButton.selector}"]`)
    .first();
  await cancel.waitFor({ state: 'visible', timeout: waitMs }).catch(() => undefined);
  if (!(await cancel.isVisible().catch(() => false))) {
    return false;
  }
  await cancel.click();
  await cancel.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  return true;
}
