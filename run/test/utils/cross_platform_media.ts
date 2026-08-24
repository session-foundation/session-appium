import { resolve } from 'path';

import type { DesktopWrapper } from '../../desktop/DesktopWrapper';
import type { AttachmentType } from '../../desktop/types';
import type { DeviceWrapper } from '../../types/DeviceWrapper';
import type { IBaseDeviceWrapper } from '../../types/IBaseDeviceWrapper';

import { testImage } from '../../constants/testfiles';
import { sendMedia, trustUser } from '../../desktop/send_media';
import { MediaMessage, MessageBody } from '../locators/conversation';

/** The photo every cross-client format check sends. A real JPEG, deliberately: see [RENDER_FLOOR_BYTES]. */
export const CROSS_CLIENT_PHOTO = resolve(__dirname, '../media', testImage);

/**
 * How large a rendered attachment's own screenshot must be before we call it rendered.
 *
 * The point of these specs is that the BYTES survive the round trip, so the assertion has to be about
 * pixels rather than about an element existing. A failed decrypt still leaves a bubble, a spinner or a
 * broken-image placeholder in the tree — all of which satisfy "the attachment is present" and none of
 * which satisfy this.
 *
 * A flat colour would have made the pixel check trivial to state, and is exactly what NOT to send: a
 * solid image's screenshot compresses to almost nothing, so it fails this floor while rendering
 * perfectly. Hence a photo, and hence a floor rather than an expected colour. Desktop's
 * `verifyMediaPreviewLoaded` already uses the same 5 kB reasoning; this mirrors it so the two platforms
 * are judged the same way.
 */
const RENDER_FLOOR_BYTES = 5_000;

/**
 * How long an attachment gets to come back off the file server and draw.
 *
 * Generous on purpose: this covers a fetch over onion routing, not a locally-staged preview, and the
 * element does not exist until the download completes. A tight bound here fails as "did not render",
 * which is the one thing these specs must not say when the truth is "not yet".
 */
const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 60_000;

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
 * path — hence the sender's name, and hence trusting before asserting on both platforms. A seeded
 * friendship does not pre-trust attachments; the existing Desktop media specs click the same prompt.
 */
export async function verifyPhotoRendered(
  client: IBaseDeviceWrapper,
  caption: string,
  senderName: string
): Promise<void> {
  if (!isMobile(client)) {
    const page = (client as DesktopWrapper).getPage();
    await client.waitForMessage(caption);

    // A seeded friendship does NOT pre-trust attachments: Desktop declines the download until the
    // prompt is clicked, logging "not downloading attachments yet as this user is not trusted for now",
    // and the element the assertion below waits for never appears.
    //
    // PHOTO_ATTACHMENT_TYPE is `media`, not `image` — see its definition.
    await trustUser(page, PHOTO_ATTACHMENT_TYPE, senderName);

    // Not `verifyMediaPreviewLoaded`: its wait for the attachment element is a hardcoded 5s, which is
    // enough for a locally-staged send and not enough for one that has to come back off the file server
    // — measured here, where the element appears only once the download completes. Same criterion as the
    // mobile branch below, so a photo is judged the same way on all three clients.
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

  const element = await client.waitForTextElementToBePresent(new MediaMessage(client));
  const base64 = await client.getElementScreenshot(element.ELEMENT);
  assertRendered(Buffer.from(base64, 'base64').length, caption);
}
