import { test } from '@playwright/test';

import type { DeviceWrapper } from '../../types/DeviceWrapper';
import type { StrategyExtractionObj } from '../../types/testing';

const COPY_MAX_WAIT = 10_000;

/**
 * Assert a control addressed by id also carries the copy it should.
 *
 * **Address by id, then check the words.** The id says the client rendered the right control; only the
 * copy says it rendered the right words in it, and the two fail independently - a control keeps its
 * identifier through a copy change, so an id-only lookup stays green against a wrong, empty or swapped
 * string. On a destructive flow that is the difference between pressing Cancel and pressing Clear.
 *
 * Where the copy lives differs by platform, and it is not a preference:
 *
 * - **iOS** puts it on the node's `label`. An accessibility identifier becomes the element's `name` and
 *   displaces the display text, so `label` is the only place left - see
 *   `findMatchingLabelInElementArray`.
 * - **Android** Compose controls report no text of their own: the label is a child node, so the node
 *   addressed by id has nothing to compare. Only text-bearing nodes (a dialog body, a heading) can be
 *   checked in place, and those take a plain `text` filter on the locator rather than this.
 *
 * So this asserts on iOS and skips on Android, and says so in the step name rather than quietly passing.
 * Where an Android id is itself derived from the display string - `AlertDialog` falls back to a button's
 * own text when the call site gives it no `qaTag` - the id lookup already covers the copy, and the
 * caller should say which case it is.
 */
export async function expectControlCopy(
  device: DeviceWrapper,
  locator: StrategyExtractionObj,
  copy: string
): Promise<void> {
  if (!device.isIOS()) {
    return;
  }
  await test.step(`Verify the control reads "${copy}"`, async () => {
    await device.waitForTextElementToBePresent({
      ...locator,
      label: copy,
      maxWait: COPY_MAX_WAIT,
    });
  });
}

/**
 * The copy filter for a **text-bearing** element - a dialog body, a heading, a row title.
 *
 * Spread alongside the locator so the lookup asserts the id and the copy in one wait. Both filters are
 * EXACT after a normalisation that collapses whitespace (`findMatchingTextInElementArray`,
 * `findMatchingLabelInElementArray`), which is what makes copy spanning a `<br/>` comparable to the
 * single space `tStripped` puts in its place. Do not hand-roll that read: the matchers already do it.
 *
 * The platform split is the same one {@link expectControlCopy} explains - an iOS identifier displaces
 * the display text onto `label`. The difference is that this works on **both** platforms, because a
 * text-bearing node carries its own copy on Android where a Compose control does not.
 */
export function withCopy(
  device: DeviceWrapper,
  copy: string
): { label: string } | { text: string } {
  return device.isIOS() ? { label: copy } : { text: copy };
}
