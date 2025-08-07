import { colors } from 'looks-same';
import PNG from 'png-js';

import { hexToRgbObject } from './utilities';

export async function parseDataImage(base64: string) {
  const buffer = Buffer.from(base64, 'base64');

  const reader = new PNG(buffer);
  const { height, width } = reader;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  const px = await new Promise<Buffer>(resolve => {
    reader.decodePixels(decodedPx => {
      resolve(decodedPx);
    });
  });

  // Image dimensions
  const totalPixels = width * height;

  // Auto-detect format based on buffer size
  // iOS screenshots are RGB format (3 bytes per pixel)
  // Android screenshots RGBA format (4 bytes per pixel)
  const bytesPerPixel = px.length / totalPixels;

  // Convert 2D coordinates to 1D pixel index
  const centerPixelIndex = (width * centerY) + centerX;

  // Convert pixel index to byte position
  const pixelStartByte = centerPixelIndex * bytesPerPixel;
  const pixelEndByte = pixelStartByte + 3; // RGB only, skip alpha

  // Extract RGB values
  const rgbData = px.buffer.slice(pixelStartByte, pixelEndByte);
  const hexColor = Buffer.from(rgbData).toString('hex');

  return hexColor;
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
