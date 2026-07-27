import type { ElementHandle } from '@playwright/test';

/**
 * On desktop, some elements are not radio buttons nor checkboxes, but are
 * just classic divs with the checked/unchecked states manually defined.
 * This file contains the logic to check the checked state of such elements.
 */
export async function isChecked(element: ElementHandle<unknown>): Promise<boolean> {
  return (await element.getAttribute('data-checked')) === 'true'; // yes this is a string of 'true'
}
