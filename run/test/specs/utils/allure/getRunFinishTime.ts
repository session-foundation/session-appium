import fs from 'fs-extra';
import path from 'path';
import { allureCurrentReportDir } from '../../../../constants/allure';

export async function getRunFinishTime(): Promise<string> {
  const summaryPath = path.join(allureCurrentReportDir, 'widgets', 'summary.json');
  const summaryContent = await fs.readFile(summaryPath, 'utf8') as string;
  const summary = JSON.parse(summaryContent);
  // raw timestamp from summary.time.stop, e.g. 1749169921134
  const rawTs = Number(summary.time.stop);
  if (isNaN(rawTs)) {
    throw new Error('Failed to convert timestamp to a valid date object.');
  }
  // If for some reason the value were in seconds (< 1e12), convert to milliseconds
  const millis = rawTs < 1e12 ? rawTs * 1000 : rawTs;
  const dateObj = new Date(millis);

  // Extract year, month, day, hour, minute (padded)
  const YYYY = dateObj.getFullYear();
  const MM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const DD = String(dateObj.getDate()).padStart(2, '0');
  const HH = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');

  // Combine into “YYYY-MM-DD_HH-mm”
  return `${YYYY}-${MM}-${DD}-${HH}:${mm}`;
}
