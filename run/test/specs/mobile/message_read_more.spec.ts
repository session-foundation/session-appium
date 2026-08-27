import { test, type TestInfo } from '@playwright/test';

import { STANDARD_MAX_CHARS } from '../../../shared/constants';
import { TestSteps } from '../../../types/allure';
import { androidIt } from '../../../types/sessionIt';
import { MessageReadMore } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';

/** Marks the end of the message, so finding it proves the tail is reachable rather than the head. */
const TAIL_MARKER = 'END-OF-LONG-MESSAGE';

/** At the standard limit, so no Pro is involved — and long enough to wrap well past 25 lines. */
const LONG_MESSAGE = `${'word '.repeat(Math.floor((STANDARD_MAX_CHARS - TAIL_MARKER.length) / 5))}${TAIL_MARKER}`;

androidIt({
  title: 'A long message collapses and Read More expands it',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: messageReadMore,
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Rules',
  },
  allureDescription:
    'A message longer than 25 rendered lines is collapsed with a Read More button, and tapping it ' +
    'reveals the rest.',
});

/**
 * The collapsed message bubble, and the button that opens it.
 *
 * **Android only, and iOS is not an omission.** There the Read More label is a subview of a bubble that
 * sets `isAccessibilityElement = true`, which makes the bubble a leaf — an identifier was added to that
 * subview, confirmed compiled into the app, and measured unfindable (20s, 120 attempts). iOS also carries
 * the full message text in the bubble's accessibility attributes whether or not it is visually collapsed,
 * so there is nothing to tap and nothing to gain by tapping it. Running it there and swallowing the
 * failure would spend that 20s every run and disguise a real platform difference as a flaky locator.
 *
 * **The threshold is 25 rendered LINES, not characters** (`MAX_COLLAPSED_LINE_COUNT`), so it depends on
 * font and bubble width. The message here is at the standard character limit — which needs no Pro, and
 * wraps to roughly twice the threshold on a phone, leaving margin for a wider device rather than sitting
 * on the boundary.
 *
 * Both directions are asserted. The button appearing proves the collapse; the tail becoming readable
 * proves the expansion. Either alone is weak: a bubble that never collapsed shows no button and reads
 * its tail happily, which would satisfy a tail-only assertion.
 */
async function messageReadMore(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device, contactNames } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_with_contacts({ platform, testInfo });
  });

  await test.step('Send a message longer than the collapse threshold', async () => {
    await device.clickOnElementAll(new ConversationItem(device, contactNames[0]));
    await device.sendMessage(LONG_MESSAGE);
  });

  await test.step('The bubble is collapsed, and offers Read More', async () => {
    // Presence of the button IS the collapse assertion: it renders only when the text overflows, and it
    // is `gone` otherwise — which on Android means absent from the hierarchy rather than merely hidden.
    await device.waitForTextElementToBePresent({
      ...new MessageReadMore(device).build(),
      maxWait: 20_000,
    });
  });

  await test.step('Read More reveals the rest', async () => {
    await device.clickOnElementAll(new MessageReadMore(device));
    // The tail rather than the button's absence: a button that failed to render, or an id that stopped
    // matching, would satisfy an is-it-gone assertion without anything having expanded.
    await device.waitForMessageContaining(TAIL_MARKER, 20_000);
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
