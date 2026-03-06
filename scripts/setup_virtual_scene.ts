/**
 * Copies virtual scene config files from the repo to local Android SDK folder if necessary.
 *
 * NOTE: This only works if the emulators' back camera is set to `virtualscene`:
 * The config.ini must have a `hw.camera.back=virtualscene` entry. 
 * 
 * The Toren1BD.posters file keeps track of where to show posters (images) in the virtual camera scene.
 * It has been modified so that the `table` poster shows right in front of where the camera opens, 
 * scaled up 2x, positioned at x: 0, y: 0, z: -1.5. 
 * This is necessary because appium's injection method manipulates this specific poster's image content.
 * This has been the only reliable way to get this working other than patching appium and the android driver.
 *
 * The file is global for all emulators on the host machine but each appium session can temporarily modify the image.
 *
 * CI: This script runs before emulator boot.
 * Local dev: Run `pnpm setup-virtual-scene` once and reboot emulators for the changes to take effect.
 */

import { copyFileSync, readFileSync } from 'fs';
import path from 'path';

const sdkRoot = process.env.ANDROID_SDK_ROOT;
if (!sdkRoot) {
  throw new Error('ANDROID_SDK_ROOT is not set');
}

const resourcesDir = path.join(sdkRoot, 'emulator', 'resources');

const files = ['placeholder.png', 'Toren1BD.posters'];

function syncFile(filename: string) {
  const repoFile = path.join(__dirname, 'resources', filename);
  const sdkFile = path.join(resourcesDir, filename);

  const repoContent = readFileSync(repoFile);

  let needsCopy = true;
  try {
    needsCopy = !repoContent.equals(readFileSync(sdkFile));
  } catch {
    // File doesn't exist in SDK yet
  }

  if (!needsCopy) {
    console.log(`${filename} already up to date`);
  } else {
    copyFileSync(repoFile, sdkFile);
    console.log(`${filename} updated at ${sdkFile}`);
  }
}

files.forEach(syncFile);
