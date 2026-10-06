// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.
// Derives a mocked point in time from a relative offset — used to fake account/app age
// (iOS "first install" date on mobile, DB creation timestamp on desktop).

export type TimeOffset = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

/**
 * Apply a relative offset to "now" and return both the Date and its unix (seconds) timestamp.
 *
 * The offset is elapsed time, not calendar time: both apps compare against a fixed number of seconds
 * (7 days is 604800), and a calendar step through a daylight-saving change is an hour short or long,
 * which put "7 days 2 minutes ago" inside the 7-day window for the week after a DST change.
 */
function applyTimeOffset(offset: TimeOffset): { date: Date; timestamp: string } {
  const offsetMs =
    ((((offset.days ?? 0) * 24 + (offset.hours ?? 0)) * 60 + (offset.minutes ?? 0)) * 60 +
      (offset.seconds ?? 0)) *
    1000;
  const date = new Date(Date.now() + offsetMs);

  const timestamp = String(Math.floor(date.getTime() / 1000));
  return { date, timestamp };
}

/**
 * Set a custom "first install" date for the iOS app with granular control (mobile).
 * @example setIOSFirstInstallDate({ days: -7, minutes: -2 }) // 7 days and 2 minutes ago
 */
export function setIOSFirstInstallDate(offset: TimeOffset): string {
  const { date, timestamp } = applyTimeOffset(offset);
  console.log(`Mocking iOS first install date: ${timestamp} (${date.toLocaleString('en-AU')})`);
  return timestamp;
}

/**
 * Compute a mocked DB creation timestamp (ms epoch) from a relative offset (desktop).
 * @example mockDBCreationTime({ days: -7, minutes: -2 }) // 7 days and 2 minutes ago
 */
export function mockDBCreationTime(offset: TimeOffset): number {
  return applyTimeOffset(offset).date.getTime();
}
