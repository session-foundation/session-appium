import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DeviceWrapper } from '../../../types/DeviceWrapper';

const TARGET_GROUP_ID = 'group.com.apple.FileProvider.LocalStorage';
const MEDIA_ROOT = path.join('run', 'test', 'specs', 'media');

/**
 * Utility for copying a file from the local 'media' directory to the current iOS simulator's
 * "Downloads" folder (inside the Files app group container) on disk, if not already present.
 *
 * Motivation: 'xcrun simctl addmedia' does not support PDFs, and downloading files in tests is unreliable.
 */

/**
 * Get the group container path for the Files app on the simulator.
 */
function getFilesAppGroupContainerPath(udid: string): string {
  const listAppsOutput = execSync(`xcrun simctl listapps ${udid}`, { encoding: 'utf8' });
  const groupContainerRegex = (groupId: string) => new RegExp(`"${groupId}" = "file://([^"]+)"`);
  const match = listAppsOutput.match(groupContainerRegex(TARGET_GROUP_ID));
  if (!match?.[1]) {
    throw new Error(`Group container for "${TARGET_GROUP_ID}" not found.`);
  }
  return match[1];
}

/**
 * Get the full destination path for the file in the simulator's Downloads folder.
 */
function getSimulatorDownloadsPath(groupContainerPath: string, filename: string): { downloadsPath: string, destinationPath: string } {
  const downloadsPath = path.join(groupContainerPath, 'File Provider Storage', 'Downloads');
  const destinationPath = path.join(downloadsPath, filename);
  return { downloadsPath, destinationPath };
}

/**
 * Copies a file from the 'media' directory to the simulator's "Downloads" folder on disk if not already present.
 */
export function copyFileToSimulator(device: DeviceWrapper, filename: string): void {
  const sourcePath = path.join(MEDIA_ROOT, filename);

  const groupContainerPath = getFilesAppGroupContainerPath(device.udid);
  const { downloadsPath, destinationPath } = getSimulatorDownloadsPath(groupContainerPath, filename);

  if (fs.existsSync(destinationPath)) {
    console.log(`File already exists in simulator: ${destinationPath}`);
    return;
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }
  fs.mkdirSync(downloadsPath, { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  console.log(`Copied ${filename} to simulator Downloads at: ${downloadsPath}`);
}