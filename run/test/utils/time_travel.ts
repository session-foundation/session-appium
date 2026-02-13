type TimeOffset = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

/**
 * Internal helper to apply time offset and return unix timestamp
 */
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
 * Set a custom "first install" date for iOS app with granular control
 * @param offset - Object with days, hours, minutes, seconds (all optional)
 * @example setIOSFirstInstallDate({ days: -7, minutes: -2 }) // 7 days and 2 minutes ago
 */
export function setIOSFirstInstallDate(offset: TimeOffset): string {
  const { date, timestamp } = applyTimeOffset(offset);
  console.log(`Mocking iOS first install date: ${timestamp} (${date.toLocaleString('en-AU')})`);
  return timestamp;
}
