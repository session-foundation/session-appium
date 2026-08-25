/* eslint-disable no-useless-escape */
// Import paths rewritten for run/desktop/ and catch-clause error access made type-safe.
// Also adapted: doWhileWithMax aborts on closed-window errors, and checkPathLight's default
// timeout was lowered from 500000 to 20_000

import { ElementHandle, expect, Page } from '@playwright/test';

import {
  ellipsizeForLog,
  MAX_SELECTOR_LOG_LENGTH,
  MAX_TEXT_LOG_LENGTH,
} from '../shared/log_text';
import { sleepFor } from '../shared/promise_utils';
import { Conversation, CTA, HomeScreen } from './locators';
import { sendMessage } from './message';
import {
  DataTestId,
  DMTimeOption,
  ModalId,
  Strategy,
  StrategyExtractionObj,
  WithMaxWait,
  WithPage,
  WithRightButton,
} from './types';

type ElementOptions = {
  maxWait?: number;
  rightButton?: boolean;
  strictMode?: boolean;
};

export function escapeText(text: string) {
  /* prettier-ignore */

  return text.replace(/"/g, '\\\"');
}

/**
 * This function can be used to make sure all the possible values as input of a switch is taken care off, without having a default case.
 */
export function assertUnreachable(_x: never, message: string): never {
  const msg = `assertUnreachable: Didn't expect to get here with "${message}"`;
  // eslint:disable: no-console

  console.info(msg);
  throw new Error(msg);
}

// WAIT FOR FUNCTIONS

export async function waitForTestIdWithText(
  window: Page,
  dataTestId: DataTestId,
  text?: string,
  maxWait?: number
) {
  const builtSelector = buildSelectorEscapeText(
    { strategy: 'data-testid', selector: dataTestId },
    text
  );
  const found = await window.waitForSelector(builtSelector, {
    timeout: maxWait,
  });

  return found;
}

export async function waitForElement({
  window,
  locator,
  options,
}: {
  window: Page;
  locator: StrategyExtractionObj;
  options?: { maxWaitMs?: number; text?: string; shouldLog?: boolean };
}) {
  const builtSelector = buildSelectorEscapeText(locator, options?.text);

  const start = Date.now();
  if (options?.shouldLog) {
    console.log(
      `waitForElement: ${ellipsizeForLog(builtSelector, MAX_SELECTOR_LOG_LENGTH)} for maxMs ${options?.maxWaitMs}`
    );
  }

  const el = await window.waitForSelector(builtSelector, {
    timeout: options?.maxWaitMs,
  });
  if (options?.shouldLog) {
    console.log(
      `waitForElement: got ${ellipsizeForLog(builtSelector, MAX_SELECTOR_LOG_LENGTH)} after ${Date.now() - start}ms`
    );
  }

  return el;
}

export async function waitForTextMessage(
  window: Array<Page> | Page,
  text: string,
  maxWait?: number
) {
  const builtSelector = buildSelectorEscapeText(
    { selector: 'message-content', strategy: 'data-testid' },
    text
  );

  console.info(
    'waitForTextMessage: builtSelector:',
    ellipsizeForLog(builtSelector, MAX_SELECTOR_LOG_LENGTH)
  );
  const windows = Array.isArray(window) ? window : [window];
  const el = await Promise.all(
    windows.map(w => w.waitForSelector(builtSelector, { timeout: maxWait }))
  );
  console.info(`Text message found. Text: "${ellipsizeForLog(text, MAX_TEXT_LOG_LENGTH)}"`);
  return el[0];
}

export async function waitForTextMessages(
  window: Array<Page> | Page,
  texts: Array<string>,
  maxWait?: number
) {
  const windows = Array.isArray(window) ? window : [window];

  return Promise.all(texts.map(async t => waitForTextMessage(windows, t, maxWait)));
}

export async function waitForControlMessageWithText(window: Page, text: string) {
  return waitForTestIdWithText(window, 'message-content', text);
}

export async function waitForMatchingText(
  window: Array<Page> | Page,
  text: string,
  maxWait: number
) {
  const builtSelector = `css=:has-text("${text}")`;
  console.info(
    `waitForMatchingText: ${ellipsizeForLog(text, MAX_TEXT_LOG_LENGTH)} for maxWait: ${maxWait}ms`
  );
  const start = Date.now();

  const windows = Array.isArray(window) ? window : [window];
  const found = await Promise.all(
    windows.map(w => w.waitForSelector(builtSelector, { timeout: maxWait }))
  );

  console.info(
    `waitForMatchingText: found "${ellipsizeForLog(text, MAX_TEXT_LOG_LENGTH)}" in ${Date.now() - start}ms`
  );
  return found[0];
}

export async function waitForMatchingPlaceholder(
  window: Page,
  dataTestId: DataTestId,
  placeholder: string,
  maxWait: number = 30000
) {
  let found = false;
  const start = Date.now();
  console.info(`waitForMatchingPlaceholder: ${placeholder} with dataTestId: ${dataTestId}`);

  do {
    try {
      const elem = await waitForElement({
        window,
        locator: {
          strategy: 'data-testid',
          selector: dataTestId,
        },
        options: {
          shouldLog: false,
          maxWaitMs: 100,
        },
      });
      const elemPlaceholder = await elem.getAttribute('placeholder');
      if (elemPlaceholder === placeholder) {
        console.info(
          `waitForMatchingPlaceholder found matching element with placeholder: "${placeholder}"`
        );

        found = true;
      }
      if (!found) {
        await sleepFor(100, true);
      }
    } catch (e) {
      await sleepFor(1000, true);
      console.info(
        `waitForMatchingPlaceholder failed with ${(e as Error).message}, retrying in 1s`
      );
    }
  } while (!found && Date.now() - start <= maxWait);

  if (!found) {
    throw new Error(`Failed to find dataTestId:"${dataTestId}" with placeholder: "${placeholder}"`);
  }
}
/**
 * Wait for a loading animation to run its course — tolerating it never being observable at all.
 *
 * A loader is a symptom of slow work, not a guaranteed step: on a fast network (devnet especially)
 * the work can complete between the action and this call, so the loader either never renders or is
 * gone before Playwright looks. That is a pass, not a failure. It used to be a failure — the
 * appearance wait had no explicit timeout, so a loader that had already been and gone cost the full
 * `waitForSelector` default (30s) and then threw.
 *
 * So: give it `appearWithinMs` to show up. If it never does, the work is already done — return. If
 * it does, wait up to `finishWithinMs` for it to go away.
 *
 * `finishWithinMs` also replaces a wait loop that had no deadline at all, which is why
 * `network_page.spec.ts` grew its own `networkDataLoaded` rather than use this: a loader that never
 * cleared used to hang until the test timed out with nothing to go on. Now it fails against this
 * selector, which says what was still spinning.
 */
export async function waitForLoadingAnimationToFinish(
  window: Page,
  loader: DataTestId,
  appearWithinMs = 2_000,
  finishWithinMs = 60_000
) {
  const selector = buildSelectorEscapeText({ strategy: 'data-testid', selector: loader });

  const appeared = await window
    .waitForSelector(selector, { timeout: appearWithinMs, state: 'visible' })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    console.info(
      `${loader} did not appear within ${appearWithinMs}ms — the work it covers is already done`
    );
    return;
  }

  console.info(`${loader} was found, waiting for it to be gone`);
  await window.waitForSelector(selector, { timeout: finishWithinMs, state: 'hidden' });
  console.info('Loading animation has finished');
}

export async function doWhileWithMax(
  maxWaitMs: number,
  waitBetweenMs: number,
  label: string,
  actionTodo: () => Promise<boolean>
) {
  const start = Date.now();
  let iteration = 0;
  let wasSuccess = false;
  let lastError: string | undefined;
  let loggedError: string | undefined;
  do {
    try {
      wasSuccess = await actionTodo();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // If the window/context/browser is gone, retrying can only spin until maxWait —
      // it's unrecoverable, so abort immediately with a clear error.
      if (message.includes('has been closed') || message.includes('Target closed')) {
        throw new Error(`doWhileWithMax with label:"${label}" aborted (window closed): ${message}`);
      }
      lastError = message;
      // This is a poll: a per-iteration miss is expected, so log only the first line
      // (Playwright appends a multi-line "Call log:") and only when it changes — otherwise
      // an N-second wait floods the output with the same error once per iteration.
      const firstLine = message.split('\n')[0];
      if (firstLine !== loggedError) {
        console.error(`doWhileWithMax "${label}" not ready (iteration ${iteration}): ${firstLine}`);
        loggedError = firstLine;
      }
    }
    iteration++;
    await sleepFor(waitBetweenMs);
  } while (!wasSuccess && Date.now() - start < maxWaitMs);

  if (!wasSuccess) {
    throw new Error(
      `doWhileWithMax with label:"${label}" still failing after ${maxWaitMs}ms${
        lastError ? `: ${lastError.split('\n')[0]}` : ''
      }`
    );
  }
}

export async function checkPathLight(window: Page, maxWait?: number) {
  const maxWaitTime = maxWait || 20_000;
  const waitPerLoop = 100;
  const start = Date.now();
  let pathFilter: string | null = null;

  await doWhileWithMax(maxWaitTime, waitPerLoop, 'checkPathLight', async () => {
    const pathLight = await waitForElement({
      window,
      locator: {
        strategy: 'data-testid',
        selector: 'path-light-svg',
      },
      options: {
        // Per-iteration timeout: the doWhileWithMax loop owns the overall budget
        // (maxWaitTime), so each attempt must return quickly. Binding this to the
        // full budget (or Playwright's default when maxWait is undefined) would let
        // a single missing-element attempt block far past maxWaitTime.
        maxWaitMs: waitPerLoop,
        shouldLog: false,
      },
    });

    pathFilter = await pathLight.getAttribute('style');

    if (Date.now() - start >= maxWaitTime / 10) {
      console.log('Path building...');
    }

    return !!pathFilter?.includes('var(--button-path-default-color)');
  });

  console.log('Path built correctly', pathFilter);
}

export async function reloadWindow(window: Page, awaitOnionPath: boolean = true) {
  await window.reload();
  // Playwright might think the page already reloaded but the path might not be rebuilt yet
  if (awaitOnionPath) {
    await checkPathLight(window);
  }
}

// ACTIONS

/**
 * Clicks on an element using a locator object
 * @param window - Playwright page instance
 * @param locator - Element locator with strategy and selector
 * @param options - Optional element interaction configuration
 */
export async function clickOn(
  window: Page,
  locator: StrategyExtractionObj,
  options?: ElementOptions
) {
  let builtSelector: string;

  if (locator.strategy === 'class') {
    builtSelector = `css=.${locator.selector}`;
  } else {
    builtSelector = `css=[${locator.strategy}=${locator.selector}]`;
  }

  const sharedOpts = {
    timeout: options?.maxWait,
    strict: options?.strictMode ?? true,
  };
  await window.click(
    builtSelector,
    options?.rightButton ? { ...sharedOpts, button: 'right' } : sharedOpts
  );
}

export function buildSelectorEscapeText(locator: StrategyExtractionObj, text?: string) {
  const strategyWithSelector =
    locator.strategy === 'class'
      ? `.${locator.selector}`
      : `[${locator.strategy}=${locator.selector}]`;
  const textSelector = text ? `:has-text("${text.replace(/"/g, '\\"')}")` : '';

  const builtSelector = `css=${strategyWithSelector}${textSelector}`;

  return builtSelector;
}

/**
 * Clicks on an element that contains specific text
 * @param window - Playwright page instance
 * @param locator - Element locator with strategy and selector
 * @param text - Text content to match within the element
 * @param options - Optional element interaction configuration
 */
export async function clickOnWithText(
  window: Page,
  locator: StrategyExtractionObj,
  text: string,
  options?: Omit<ElementOptions, 'rightButton'>
) {
  const builtSelector = buildSelectorEscapeText(locator, text);

  const sharedOpts = {
    timeout: options?.maxWait,
    strict: options?.strictMode ?? true,
  };
  await window.click(builtSelector, sharedOpts);
}

export async function rightClickOnWithText(
  window: Page,
  locator: StrategyExtractionObj,
  text: string,
  options?: Omit<ElementOptions, 'rightButton'>
) {
  const builtSelector = buildSelectorEscapeText(locator, text);

  const sharedOpts = {
    timeout: options?.maxWait,
    strict: options?.strictMode ?? true,
    button: 'right' as const,
  };

  const menuItem = '[data-testid="context-menu-item"]';
  // Bound each menu wait by the caller's maxWait when they gave one, so it bounds the whole
  // operation and not just the click.
  const menuWaitMs = options?.maxWait ?? 5_000;

  for (let attempt = 0; attempt < 2; attempt++) {
    await window.click(builtSelector, sharedOpts);

    // The menu renders asynchronously and how long it takes scales with how many items it has: a
    // community's has 9 and was measured at ~230ms, which the previous 100ms budget sat just below —
    // so leaving a community failed almost every time while the shorter 1:1 menus passed.
    const appeared = await window
      .waitForSelector(menuItem, { timeout: menuWaitMs })
      .then(() => true)
      .catch(() => false);

    // Sometimes the right click makes the window move slightly, which closes the menu again. So
    // require it to still be there a moment later rather than trusting the first sighting.
    if (appeared) {
      await sleepFor(100, false);
      if ((await window.locator(menuItem).count()) > 0) {
        return;
      }
    }

    // Dismiss whatever is on screen before re-clicking: a right click while the menu is open just
    // closes it, which made the retry strictly worse than the first attempt.
    await window.keyboard.press('Escape').catch(() => undefined);
    await sleepFor(500, true);
  }
  throw new Error(`rightClickOnWithText: context menu never appeared for "${text}"`);
}

// Legacy wrapper for backwards compatibility
export async function clickOnElement({
  window,
  maxWait,
  rightButton,
  ...obj
}: WithPage & StrategyExtractionObj & WithMaxWait & WithRightButton) {
  return clickOn(window, obj, { maxWait, rightButton });
}

export async function lookForPartialTestId(
  window: Page,
  selector: string,
  click?: boolean,
  rightButton?: boolean,
  maxWait?: number
) {
  const builtSelector = `css=[data-testid^="${selector}"]`;
  const sharedOpts = { timeout: maxWait };

  if (click) {
    await window.click(
      builtSelector,
      rightButton ? { ...sharedOpts, button: 'right' } : sharedOpts
    );
  }
  return builtSelector;
}

export async function clickOnMatchingText(
  window: Page,
  text: string,
  rightButton = false,
  timeoutMs?: number
) {
  console.info(`clickOnMatchingText: "${ellipsizeForLog(text, MAX_TEXT_LOG_LENGTH)}"`);
  return window.click(
    `"${text}"`,
    rightButton ? { button: 'right', timeout: timeoutMs } : { timeout: timeoutMs }
  );
}

export async function clickOnTextMessage(
  window: Page,
  text: string,
  rightButton?: boolean,
  maxWait?: number
) {
  const builtSelector = buildSelectorEscapeText(
    { selector: 'message-content', strategy: 'data-testid' },
    text
  );
  const sharedOpts = { timeout: maxWait };

  await window.click(builtSelector, rightButton ? { ...sharedOpts, button: 'right' } : sharedOpts);
}

export function getMessageTextContentNow() {
  return `Test message timestamp: ${Date.now()}`;
}

export async function pasteIntoInput(window: Page, dataTestId: DataTestId, text: string) {
  console.info(
    `pasteIntoInput testId: ${dataTestId} : "${ellipsizeForLog(text, MAX_TEXT_LOG_LENGTH)}"`
  );
  const builtSelector = `css=[data-testid="${dataTestId}"]`;
  // the new input made with onboarding element needs a click to reveal the input in the DOM
  // Convert DataTestId to locator object for clickOn
  const locator = { strategy: 'data-testid' as const, selector: dataTestId };
  await clickOn(window, locator);
  // reset the content to be empty before typing into the input
  await window.fill(builtSelector, '');
  await window.fill(builtSelector, text);
}

export async function doesTextIncludeString(window: Page, dataTestId: DataTestId, text: string) {
  const element = await waitForTestIdWithText(window, dataTestId);
  const el = await element.innerText();

  const builtSelector = el.includes(text);
  if (builtSelector) {
    console.info('Text found:', ellipsizeForLog(text, MAX_TEXT_LOG_LENGTH));
  } else {
    throw new Error(`Text not found: "${ellipsizeForLog(text, MAX_TEXT_LOG_LENGTH)}"`);
  }
}

export async function grabTextFromElement(window: Page, strategy: Strategy, selector: string) {
  const builtSelector = `css=[${strategy}=${selector}]`;
  const element = await window.waitForSelector(builtSelector);
  return element.innerText();
}

export async function hasElementBeenDeleted(
  window: Page,
  locator: StrategyExtractionObj,
  options: {
    maxWait: number;
    text?: string;
  }
) {
  const start = Date.now();

  let el: ElementHandle<HTMLElement | SVGElement> | undefined;
  console.info(
    `waiting for element to be deleted "${locator.strategy}:${locator.selector}:${options.text}", maxWait: ${options.maxWait}ms`
  );
  let hasLoggedAlready = false;
  do {
    try {
      el = await waitForElement({
        window,
        locator,
        options: {
          maxWaitMs: 100, // the outer loop is the one using the options.maxWait, not this one.
          text: options.text,
          shouldLog: false,
        },
      });
      await sleepFor(100);
      if (!hasLoggedAlready) {
        console.info(`Element has been found, waiting for deletion`);
        hasLoggedAlready = true;
      }
    } catch (_e) {
      el = undefined;
      console.info(`Element has been deleted, woohoo!`);
    }
  } while (Date.now() - start <= options.maxWait && el);
  try {
    el = await waitForElement({
      window,
      locator,
      options: {
        maxWaitMs: 100, // the element should be there once the loop exits. if it's not right away it's an error.
        text: options.text,
        shouldLog: false,
      },
    });
  } catch (_e) {
    // if we did throw here it's actually because the element is gone, so it's ok
  }

  if (el) {
    throw new Error(
      `hasElementBeenDeleted: element with selector ${locator.selector} was expected to be gone but is still there`
    );
  }
  console.info(
    `Element "${locator.strategy}:${locator.selector}:${options.text}" has been deleted yay`
  );
}

export async function hasTextMessageBeenDeleted(
  window: Page,
  text: string,
  maxWait: number = 5000
) {
  await doWhileWithMax(maxWait, 500, 'waiting for text message to be deleted', async () => {
    try {
      await waitForElement({
        window,
        locator: Conversation.messageContent,
        options: {
          maxWaitMs: maxWait,
          text,
          shouldLog: false,
        },
      });
      return false;
    } catch (_e) {
      console.info(`Text message not found, yay!`);
      return true;
    }
  });
}

export async function hasElementPoppedUpThatShouldnt(
  window: Page,
  locator: StrategyExtractionObj,
  text?: string
) {
  const builtSelector = buildSelectorEscapeText(locator, text);

  const fakeError = `Found ${locator.selector}, oops..`;
  const elVisible = await window.isVisible(builtSelector);
  if (elVisible === true) {
    throw new Error(fakeError);
  }
  return builtSelector;
}

export async function doesElementExist(
  window: Page,
  locator: StrategyExtractionObj,
  text?: string
) {
  const builtSelector = buildSelectorEscapeText(locator, text);

  const fakeError = `Element ${locator.selector} does not exist`;
  const elVisible = await window.isVisible(builtSelector);
  if (!elVisible) {
    console.log(fakeError);
    return undefined;
  }
  console.log(`Element ${locator.selector} exists`);
  return builtSelector;
}

export async function measureSendingTime(window: Page, messageNumber: number) {
  const message = `Test-message`;
  const timeStart = Date.now();

  await sendMessage(window, message);

  const timeEnd = Date.now();
  const timeMs = timeEnd - timeStart;

  console.log(`Message ${messageNumber}: ${timeMs}`);
  return timeMs;
}

export function removeNewLines(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Drop icon-font glyphs, which live in Unicode's private-use area and carry no meaning to a reader.
 *
 * Lucide icons share a text node with the copy beside them, so they turn up in `innerText`.
 */
function stripIconGlyphs(input: string): string {
  return input.replace(/[\uE000-\uF8FF]/g, '').trim();
}

/**
 * Asserts that actual text matches expected text.
 * @throws Error with detailed message if texts don't match
 */
function assertTextMatches(actual: string, expected: string, fieldName: string): void {
  const sanitizedActual = removeNewLines(actual);
  const sanitizedExpected = removeNewLines(expected);

  if (sanitizedExpected !== sanitizedActual) {
    throw new Error(
      `${fieldName} is incorrect.\nExpected: ${sanitizedExpected}\nActual: ${sanitizedActual}\n`
    );
  }
}

export async function checkModalStrings(
  window: Page,
  expectedHeading: string,
  expectedDescription?: string,
  modalId?: ModalId
) {
  let modalSelector = '[data-modal-id]'; // Base selector for modals

  // If a specific modal ID is provided, target that one
  if (modalId) {
    modalSelector = `[data-modal-id="${modalId}"]`;
  }

  // Find the target modal
  const targetModal = window.locator(modalSelector).first();

  // Wait for the modal to be visible
  await targetModal.waitFor({ state: 'visible' });

  // Get elements within this specific modal
  const heading = targetModal.locator('[data-testid="modal-heading"]');

  // Wait for these elements to be visible
  await heading.waitFor({ state: 'visible' });

  const headingText = await heading.innerText();
  assertTextMatches(headingText, expectedHeading, 'Modal heading');
  if (expectedDescription) {
    const description = targetModal.locator('[data-testid="modal-description"]');
    await description.waitFor({ state: 'visible' });
    const descriptionText = await description.innerText();
    assertTextMatches(descriptionText, expectedDescription, 'Modal description');
  }
}

export async function verifyNoCTAShows(window: Page) {
  await sleepFor(1_000); // Let the UI settle
  await Promise.all([
    hasElementPoppedUpThatShouldnt(window, CTA.heading),
    hasElementPoppedUpThatShouldnt(window, CTA.description),
    hasElementPoppedUpThatShouldnt(window, CTA.confirmButton),
    hasElementPoppedUpThatShouldnt(window, CTA.cancelButton),
  ]);
}

export async function checkCTAStrings(
  window: Page,
  expectedHeading: string,
  expectedBody: string | undefined,
  expectedButtons: Array<string>,
  expectedFeatures?: Array<string>,
  bodyMatch: 'contains' | 'exact' = 'exact'
) {
  // Validate input
  if (expectedFeatures && expectedFeatures.length > 3) {
    throw new Error('CTAs support maximum 3 features');
  }
  // Zero is legitimate: an acknowledgement CTA has a cancel button and no confirm, and the buttons
  // here are positional (confirm first), so it has nothing to pass.
  if (expectedButtons.length > 2) {
    throw new Error('CTAs support maximum 2 buttons');
  }

  // Find the target CTA modal
  const modalSelector = '[data-modal-id="sessionProInfoModal"]';
  const targetModal = window.locator(modalSelector).first();

  // Wait for the modal to be visible
  await targetModal.waitFor({ state: 'visible' });

  // Check heading
  const heading = targetModal.locator(`[${CTA.heading.strategy}="${CTA.heading.selector}"]`);
  await heading.waitFor({ state: 'visible' });
  const headingText = await heading.innerText();
  assertTextMatches(headingText, expectedHeading, 'CTA heading');

  // Check body
  const body = targetModal.locator(`[${CTA.description.strategy}="${CTA.description.selector}"]`);
  await body.waitFor({ state: 'visible' });
  // Some CTAs interpolate data the shared table cannot know, so it carries no body for them.
  if (expectedBody === undefined) {
    return;
  }
  const bodyText = await body.innerText();
  if (bodyMatch === 'contains') {
    const haystack = stripIconGlyphs(bodyText).replace(/\s+/g, ' ');
    const needle = stripIconGlyphs(expectedBody).replace(/\s+/g, ' ');
    if (!haystack.includes(needle)) {
      throw new Error(
        `CTA body does not contain the expected text.\nExpected: ${needle}\nActual: ${haystack}\n`
      );
    }
  } else {
    assertTextMatches(bodyText, expectedBody, 'CTA body');
  }

  if (expectedFeatures) {
    for (let i = 0; i < expectedFeatures.length; i++) {
      const featureLocator = CTA.feature(i + 1);
      const feature = targetModal.locator(
        `[${featureLocator.strategy}="${featureLocator.selector}"]`
      );
      await feature.waitFor({ state: 'visible' });
      // Lets the shared cross-platform CTA table be compared verbatim. Without it the failure is
      // unreadable — the glyph has no width in a terminal, so expected and actual print identically.
      const featureText = stripIconGlyphs(await feature.innerText());
      assertTextMatches(featureText, stripIconGlyphs(expectedFeatures[i]), `CTA feature ${i + 1}`);
    }
  }

  // A CTA may have no confirm button at all (an acknowledgement rather than an offer), in which case
  // there is nothing positional to check and the caller asserts the cancel button itself.
  if (!expectedButtons.length) {
    return;
  }

  // Check positive button
  const positiveButton = targetModal.locator(
    `[${CTA.confirmButton.strategy}="${CTA.confirmButton.selector}"]`
  );
  await positiveButton.waitFor({ state: 'visible' });
  const positiveButtonText = await positiveButton.innerText();
  assertTextMatches(positiveButtonText, expectedButtons[0], 'CTA positive button');

  // Check negative button if provided
  if (expectedButtons.length === 2) {
    const negativeButton = targetModal.locator(
      `[${CTA.cancelButton.strategy}="${CTA.cancelButton.selector}"]`
    );
    await negativeButton.waitFor({ state: 'visible' });
    const negativeButtonText = await negativeButton.innerText();
    assertTextMatches(negativeButtonText, expectedButtons[1], 'CTA negative button');
  }
}
export function formatTimeOption(option: DMTimeOption) {
  const timePart = option.replace('time-option-', '');
  const formattedTime = timePart.replace(/-/g, ' ');
  return formattedTime;
}

// Shared cross-platform helper (mobile + desktop) lives in run/shared/url.ts.
export { assertUrlIsReachable } from '../shared/url';

export async function scrollToBottomIfNecessary(window: Page): Promise<void> {
  const canScroll = await doesElementExist(window, Conversation.scrollToBottomButton);
  if (canScroll) {
    await clickOn(window, Conversation.scrollToBottomButton);
  }
}

export function controlOrMetaFor() {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

// Grab the inner text of every conversation item to establish order.
// Playwright suggests locator.allInnerTexts() but that doesn't work:
// Session Desktop sets window.eval = () => null in preload.js,
// which breaks Playwright's underlying evaluateAll.
export async function getConversationOrder(window: Page): Promise<string[]> {
  const items = await window.$$(`[data-testid="${HomeScreen.conversationItemName.selector}"]`);
  const texts = await Promise.all(items.map(item => item.innerText()));
  return texts.map(t => t.trim()).filter(t => t.length > 0);
}

// Asserts pinned conversations float to the top maintaining relative order,
// followed by unpinned in their original order.
// Pass an empty pinnedNames array to assert the order is fully restored (e.g. after unpinning).
export function assertPinOrder(
  beforeOrder: string[],
  pinnedNames: string[],
  afterOrder: string[]
): void {
  const pinnedSet = new Set(pinnedNames);
  const pinnedExpected: string[] = [];
  const unpinnedExpected: string[] = [];
  for (const name of beforeOrder) {
    if (pinnedSet.has(name)) {
      pinnedExpected.push(name);
    } else {
      unpinnedExpected.push(name);
    }
  }
  const expected = [...pinnedExpected, ...unpinnedExpected];

  expect(afterOrder, 'Conversations are not in the correct order').toEqual(expected);
}
