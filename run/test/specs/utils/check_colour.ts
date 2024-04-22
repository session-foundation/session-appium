import PNG from "png-js";

export async function parseDataImage(base64: string) {
  const buffer = Buffer.from(base64, "base64");

  const reader = new PNG(buffer);
  const { height, width } = reader;
  const middleX = Math.floor(width / 2);
  const middleY = Math.floor(height / 2);

  const pxDataStart = (width * middleY + middleX) * 3;
  const pxDataEnd = pxDataStart + 3;

  const px = await new Promise<Buffer>((resolve) => {
    reader.decodePixels((decodedPx) => {
      resolve(decodedPx);
    });
  });

  const middlePx = px.buffer.slice(pxDataStart, pxDataEnd);
  // console.warn("middlePx RGB: ", Buffer.from(middlePx).toString("hex"));
  const pixelColor = Buffer.from(middlePx).toString("hex");
  return pixelColor;
}
