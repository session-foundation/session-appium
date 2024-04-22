declare module "png-js" {
  class PNG {
    height: number;
    width: number;
    constructor(buffer: Buffer);

    public decodePixels(callback: (decodedPx: Buffer) => void): void;
  }

  export = PNG;
}
