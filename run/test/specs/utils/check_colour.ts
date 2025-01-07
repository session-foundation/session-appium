import PNG from 'png-js';
import { colors } from 'looks-same';

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

// Function to compare two colors within a specified CIEDE2000 tolerance
export function compareColors(hex1: string, hex2: string) {
  // looks-same expects colors as RGB objects but parseDataImage outputs hex
  function hexToRgbObject(hex: string): { R: number; G: number; B: number } {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return {
      R: (bigint >> 16) & 255,
      G: (bigint >> 8) & 255,
      B: bigint & 255,
    };
  }
  // RGB-HEX conversion
  const rgb1 = hexToRgbObject(hex1);
  const rgb2 = hexToRgbObject(hex2);

  // Compare whether colors are within tolerance
  const isSameColor: boolean = colors(rgb1, rgb2);

  return isSameColor;
}
