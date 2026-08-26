import { resolve } from 'path';

import type { DesktopWrapper } from '../../desktop/DesktopWrapper';
import type { AttachmentType } from '../../desktop/types';
import type { DeviceWrapper } from '../../types/DeviceWrapper';
import type { IBaseDeviceWrapper } from '../../types/IBaseDeviceWrapper';

import { testImage } from '../../constants/testfiles';
import { sendMedia, trustUser } from '../../desktop/send_media';
import { sleepFor } from '../../shared/promise_utils';
import { MediaInvalid, MediaMessage, MediaRetry, MessageBody } from '../locators/conversation';

/**
 * The photo every cross-client format check sends — the SAME bytes from all three clients, which is what
 * makes the comparison mean anything.
 *
 * Lives in the mobile fixture directory rather than desktop's `sample_files/` because mobile does not
 * take a path: `sendImage` selects from the simulator's preloaded library by matching this exact file, so
 * pointing desktop elsewhere would have the two platforms sending different images. It is LFS-tracked —
 * a checkout without `git lfs pull` gets a pointer file.
 *
 * Despite the extension it is a PNG. That matters only in that it is a real photograph rather than a flat
 * colour, which is what [RENDER_FLOOR_BYTES] depends on.
 */
export const CROSS_CLIENT_PHOTO = resolve(__dirname, '../media', testImage);

/**
 * How large a rendered attachment's own screenshot must be before it counts as rendered.
 *
 * A failed decrypt still leaves a bubble, a spinner or a broken-image placeholder, all of which
 * satisfy "the attachment is present" — so the assertion has to be about pixels.
 *
 * This is why the fixture is a photo: a flat colour compresses below any usable floor while rendering
 * perfectly.
 */
const RENDER_FLOOR_BYTES = 5_000;

/**
 * How long an attachment gets to come back off the file server and draw.
 *
 * Covers a fetch over onion routing, and the element does not exist until the download completes. A
 * tight bound fails as "did not render" when the truth is "not yet".
 */
const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 60_000;

/** How long between samples when waiting for a media bubble to stop changing. */
const MEDIA_SETTLE_SAMPLE_MS = 2000;

/** What the download prompt calls a photo. See [AttachmentType] for why it is not `image`. */
const PHOTO_ATTACHMENT_TYPE: AttachmentType = 'media';

/** One render verdict for all three clients, so the platforms cannot drift apart on what counts. */
function assertRendered(bytes: number, caption: string): void {
  if (bytes >= RENDER_FLOOR_BYTES) {
    return;
  }
  throw new Error(
    `The attachment for "${caption}" is present but did not render: its screenshot is ${bytes} bytes, ` +
      `under the ${RENDER_FLOOR_BYTES} floor. That is a spinner, a placeholder or a failed decrypt — ` +
      `the bubble arriving says nothing about whether the bytes survived.`
  );
}

function isMobile(client: IBaseDeviceWrapper): client is DeviceWrapper {
  return 'isIOS' in client && typeof (client as DeviceWrapper).isIOS === 'function';
}

/** Send the shared photo with `caption` as its body, from whichever client this is. */
export async function sendPhoto(client: IBaseDeviceWrapper, caption: string): Promise<void> {
  if (isMobile(client)) {
    await client.sendImage(caption);
    return;
  }

  const desktop = client as DesktopWrapper;
  await sendMedia(desktop.getPage(), CROSS_CLIENT_PHOTO, caption);
}

/**
 * Assert the photo `caption` identifies actually RENDERED on this client.
 *
 * An attachment behind an untrusted-sender prompt is never fetched, so it never reaches the decrypt
 * path — hence the sender's name. A seeded friendship does not pre-trust attachments.
 */
export async function verifyPhotoRendered(
  client: IBaseDeviceWrapper,
  caption: string,
  senderName: string
): Promise<void> {
  if (!isMobile(client)) {
    const page = (client as DesktopWrapper).getPage();
    await client.waitForMessage(caption);

    await trustUser(page, PHOTO_ATTACHMENT_TYPE, senderName);

    // Not `verifyMediaPreviewLoaded`: its wait for the attachment element is a hardcoded 5s, which a
    // fetch off the file server does not fit inside.
    const media = page
      .locator('[data-testid="message-content"]')
      .filter({ hasText: caption })
      .locator('[data-attachmentindex="0"]');
    await media.waitFor({ state: 'visible', timeout: ATTACHMENT_DOWNLOAD_TIMEOUT_MS });

    const spinner = media.locator('[data-testid="loading-animation"]');
    if (await spinner.count()) {
      await spinner.waitFor({ state: 'hidden', timeout: ATTACHMENT_DOWNLOAD_TIMEOUT_MS });
    }

    const shot = await media.screenshot({ type: 'png' });
    assertRendered(shot.length, caption);
    return;
  }

  await client.trustAttachments(senderName);
  await client.waitForTextElementToBePresent(new MessageBody(client, caption));

  await waitForMediaToSettle(client, caption);

  // A file that arrived but could not be turned into an image. On iOS this is the state an attachment
  // whose bytes will not decode lands in, and a byte floor alone passes on it because the placeholder is
  // bubble-sized — so this is what makes the render assertion able to fail.
  await assertMediaStateAbsent(client, new MediaInvalid(client), caption, 'could not be decoded');
  await assertMediaStateAbsent(client, new MediaRetry(client), caption, 'failed to download');

  const element = await client.waitForTextElementToBePresent(new MediaMessage(client));
  const base64 = await client.getElementScreenshot(element.ELEMENT);
  assertRendered(Buffer.from(base64, 'base64').length, caption);
}

/**
 * Wait until the bubble stops changing, so what follows is asked of a finished state.
 *
 * The bubble's identifier is the same while downloading as when loaded, and its placeholder is the full
 * size of the eventual image — so neither presence nor size distinguishes them. What does is motion: a
 * spinner differs between samples and a drawn photo does not.
 *
 * Returning on the first stable pair rather than polling for a fixed period keeps a loaded attachment
 * fast, and the bound is the download timeout because that is the same wait.
 */
async function waitForMediaToSettle(client: DeviceWrapper, caption: string): Promise<void> {
  const deadline = Date.now() + ATTACHMENT_DOWNLOAD_TIMEOUT_MS;
  let previous = -1;
  let lastError = 'none';

  while (Date.now() < deadline) {
    // Re-found every sample rather than held across them. The bubble is rebuilt when its image arrives,
    // which is precisely the moment being waited for, so a reference captured beforehand goes stale
    // exactly when it matters — and a stale reference throws, which would read as a product failure.
    const size = await sampleMediaSize(client).catch((e: Error) => {
      lastError = e.message.split('\n')[0];
      return -2;
    });

    if (size >= 0 && size === previous) {
      return;
    }
    previous = size;
    await sleepFor(MEDIA_SETTLE_SAMPLE_MS);
  }

  throw new Error(
    `The attachment for "${caption}" never stopped changing within ${ATTACHMENT_DOWNLOAD_TIMEOUT_MS}ms, ` +
      `so it is still loading and anything asserted after this would be asserted about a spinner. ` +
      `Last sampling error: ${lastError}.`
  );
}

/** One screenshot of the media bubble, measured by its compressed size. */
async function sampleMediaSize(client: DeviceWrapper): Promise<number> {
  const element = await client.waitForTextElementToBePresent(new MediaMessage(client));
  const shot = await client.getElementScreenshot(element.ELEMENT);
  return Buffer.from(shot, 'base64').length;
}

/** Fail with the state's own meaning rather than "an element was present". */
async function assertMediaStateAbsent(
  client: DeviceWrapper,
  locator: MediaInvalid | MediaRetry,
  caption: string,
  meaning: string
): Promise<void> {
  const found = await client.doesElementExist({ ...locator.build(), maxWait: 1000 });
  if (found) {
    throw new Error(
      `The attachment for "${caption}" ${meaning}. The bubble is present and the right size, so a ` +
        `render check alone would have passed — this is the placeholder, not the photo.`
    );
  }
}
