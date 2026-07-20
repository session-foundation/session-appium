// @ported-from tests/automation/switching_theme.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { expect } from '@playwright/test';

import { LeftPane } from '../../../desktop/locators';
import { test_Alice_1W_no_network } from '../../../desktop/sessionTest';

test_Alice_1W_no_network('Switch themes', async ({ alice }) => {
  // Create
  // Check light theme colour is correct
  const darkThemeColor = alice.getPage().locator('.inbox.index');
  await expect(darkThemeColor).toHaveCSS('background-color', 'rgb(27, 27, 27)');

  // Click theme button and change to dark theme
  await alice.clickOn(LeftPane.themeButton);
  // Check background colour of background to verify dark theme
  const lightThemeColor = alice.getPage().locator('.inbox.index');
  await expect(lightThemeColor).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  // Toggle back to light theme
  await alice.clickOn(LeftPane.themeButton);
  // Check background colour again
  await expect(darkThemeColor).toHaveCSS('background-color', 'rgb(27, 27, 27)');
});
