// @ported-from tests/automation/recovery_phrase_banner.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { DesktopWrapper } from '../../../desktop/DesktopWrapper';
import { joinDefaultCommunity, leaveCommunity } from '../../../desktop/join_community';
import { linkedDevice } from '../../../desktop/linked_device';
import { Global, HomeScreen, Settings } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import { test_Alice_1W } from '../../../desktop/sessionTest';

async function bannerShouldNotAppear(window: DesktopWrapper) {
  await window.waitForTestIdWithText(HomeScreen.plusButton.selector);
  await window.hasElementPoppedUpThatShouldnt(HomeScreen.revealRecoveryPhraseButton);
  console.log('On home screen, banner did not appear');
}

async function bannerShouldAppear(window: DesktopWrapper) {
  await window.waitForTestIdWithText(HomeScreen.plusButton.selector);
  await window.waitForTestIdWithText(HomeScreen.revealRecoveryPhraseButton.selector);
  console.log('On home screen, banner is visible');
}

test_Alice_1W('Recovery banner shows with >2', async ({ alice }) => {
  await bannerShouldNotAppear(alice);
  await joinDefaultCommunity(alice.getPage(), 'Lokinet Updates');
  await bannerShouldNotAppear(alice);
  await joinDefaultCommunity(alice.getPage(), 'Session Network Updates');
  await bannerShouldNotAppear(alice);
  await joinDefaultCommunity(alice.getPage(), 'Session Updates');
  await bannerShouldAppear(alice);
});

test_Alice_1W('Recovery banner 2 windows', async ({ alice }) => {
  await joinDefaultCommunity(alice.getPage(), 'Lokinet Updates');
  await joinDefaultCommunity(alice.getPage(), 'Session Network Updates');
  await joinDefaultCommunity(alice.getPage(), 'Session Updates');
  const alice2 = new DesktopWrapper(await linkedDevice(alice.getUser().recoveryPassword));
  await sleepFor(2_000);
  await bannerShouldNotAppear(alice2);
});

test_Alice_1W('Recovery banner persists with drop', async ({ alice }) => {
  await joinDefaultCommunity(alice.getPage(), 'Lokinet Updates');
  await joinDefaultCommunity(alice.getPage(), 'Session Network Updates');
  await joinDefaultCommunity(alice.getPage(), 'Session Updates');
  await bannerShouldAppear(alice);

  await leaveCommunity(alice.getPage(), 'Lokinet Updates');
  await bannerShouldAppear(alice);
});

test_Alice_1W('Recovery banner closes once opened', async ({ alice }) => {
  await joinDefaultCommunity(alice.getPage(), 'Lokinet Updates');
  await joinDefaultCommunity(alice.getPage(), 'Session Network Updates');
  await joinDefaultCommunity(alice.getPage(), 'Session Updates');
  await bannerShouldAppear(alice);
  await alice.clickOn(HomeScreen.revealRecoveryPhraseButton);
  await alice.waitForTestIdWithText(Settings.recoveryPasswordContainer.selector);
  await alice.clickOn(Global.modalCloseButton);
  await bannerShouldNotAppear(alice);
});
