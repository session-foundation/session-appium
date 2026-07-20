// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.
// Derives a mocked point in time from a relative offset — used to fake account/app age
// (iOS "first install" date on mobile, DB creation timestamp on desktop).

export type TimeOffset = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

/** Apply a relative offset to "now" and return both the Date and its unix (seconds) timestamp. */
function applyTimeOffset(offset: TimeOffset): { date: Date; timestamp: string } {
  const date = new Date();

  if (offset.days) date.setDate(date.getDate() + offset.days);
  if (offset.hours) date.setHours(date.getHours() + offset.hours);
  if (offset.minutes) date.setMinutes(date.getMinutes() + offset.minutes);
  if (offset.seconds) date.setSeconds(date.getSeconds() + offset.seconds);

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
