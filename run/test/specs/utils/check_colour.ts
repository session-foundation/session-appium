import { colors } from 'looks-same';
import PNG from 'png-js';

import { hexToRgbObject } from './utilities';

export async function parseDataImage(base64: string) {
  const buffer = Buffer.from(base64, 'base64');

  const reader = new PNG(buffer);
  const { height, width } = reader;
  const middleX = Math.floor(width / 2);
  const middleY = Math.floor(height / 2);

  const px = await new Promise<Buffer>(resolve => {
    reader.decodePixels(decodedPx => {
      resolve(decodedPx);
    });
  });

  // Auto-detect format based on buffer size
  // iOS screenshots are RGB format (3 bytes per pixel)
  // Android screenshots RGBA format (4 bytes per pixel)
  const bytesPerPixel = px.length / (width * height);

  const pxDataStart = (width * middleY + middleX) * bytesPerPixel;
  const pxDataEnd = pxDataStart + 3;

  const middlePx = px.buffer.slice(pxDataStart, pxDataEnd);
  const pixelColor = Buffer.from(middlePx).toString('hex');

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
