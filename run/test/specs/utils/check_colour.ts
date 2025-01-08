import PNG from 'png-js';
import { colors } from 'looks-same';
import { hexToRgbObject } from './utilities';

export async function parseDataImage(base64: string) {
  const buffer = Buffer.from(base64, 'base64');

  const reader = new PNG(buffer);
  const { height, width } = reader;
  const middleX = Math.floor(width / 2);
  const middleY = Math.floor(height / 2);

  const pxDataStart = (width * middleY + middleX) * 3;
  const pxDataEnd = pxDataStart + 3;

  const px = await new Promise<Buffer>(resolve => {
    reader.decodePixels(decodedPx => {
      resolve(decodedPx);
    });
  });

  const middlePx = px.buffer.slice(pxDataStart, pxDataEnd);
  // console.info("middlePx RGB: ", Buffer.from(middlePx).toString("hex"));
  const pixelColor = Buffer.from(middlePx).toString('hex');
  // console.info("Middle x:", middleX, "middleY:", middleY, "width:", width);
  return pixelColor;
}

// Determines if two colors look "the same" for humans even if they are not an exact match
export function isSameColor(hex1: string, hex2: string) {
  // Convert the hex strings to RGB objects
  const rgb1 = hexToRgbObject(hex1);
  const rgb2 = hexToRgbObject(hex2);
  // Perform the color comparison using the looks-same library
  const isSameColor = colors(rgb1, rgb2);
  return isSameColor;
}
