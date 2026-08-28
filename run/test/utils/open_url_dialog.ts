import { expect, test } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ModalHeading, OpenURLDialog, OpenURLDialogDescription } from '../locators/global';

const PRESENT_MAX_WAIT = 10_000;

/**
 * Read the copy of the "Open URL" dialog's body — the one element carrying the URL about to be opened.
 *
 * Per-platform, for the reason spelled out on `OpenURLDialogDescription`: Android exposes the rendered
 * body as the node's `text`, while on iOS the accessibility identifier takes over `name` and the copy is
 * only reachable on `label`.
 */
export async function readOpenUrlDialogCopy(device: DeviceWrapper): Promise<string> {
  const element = await device.waitForTextElementToBePresent({
    ...new OpenURLDialogDescription(device).build(),
    maxWait: PRESENT_MAX_WAIT,
  });

  if (device.isIOS()) {
    return (await device.getAttribute('label', element.ELEMENT)) ?? '';
  }
  return device.getTextFromElement(element);
}

/**
 * Assert the "Open URL" confirmation is up and offers `url`.
 *
 * The body is addressed through `OpenURLDialogDescription` rather than the generic `Modal description`,
 * because both clients tag this dialog's body with `open-url-description` — so the generic id is not on
 * it and a generic assertion finds nothing. The heading is still generic: only the body carries a
 * dedicated identifier.
 *
 * The description is read and compared rather than matched through a locator text filter, since on iOS
 * the identifier takes over `name` and the copy lives on `label`.
 */
export async function checkOpenUrlDialogStrings(device: DeviceWrapper, url: string): Promise<void> {
  await test.step(`Verify the Open URL confirmation offers ${url}`, async () => {
    await device.waitForTextElementToBePresent({
      ...new OpenURLDialog(device).build(),
      maxWait: PRESENT_MAX_WAIT,
    });

    const heading = await device.waitForTextElementToBePresent({
      ...new ModalHeading(device).build(),
      maxWait: PRESENT_MAX_WAIT,
    });
    expect(device.sanitizeString(await device.getTextFromElement(heading))).toBe(
      device.sanitizeString(tStripped('urlOpen'))
    );
    // Normalised because the clients render the interpolated URL as its own paragraph, which is
    // layout rather than a difference in what the string says.
    expect(device.sanitizeString(await readOpenUrlDialogCopy(device))).toBe(
      device.sanitizeString(tStripped('urlOpenDescription', { url }))
    );
  });
}
