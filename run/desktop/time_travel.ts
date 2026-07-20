// @ported-from tests/automation/utilities/time_travel.ts
// @port-kind   verbatim
type TimeOffset = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

/**
 * Calculate a custom DB creation timestamp with granular control
 * @param offset - Object with days, hours, minutes, seconds (all optional)
 * @example mockDBCreationTime({ days: -7, minutes: -2 }) // 7 days and 2 minutes ago
 */
export function mockDBCreationTime(offset: TimeOffset): number {
  const date = new Date();

  if (offset.days) {
    date.setDate(date.getDate() + offset.days);
  }
  if (offset.hours) {
    date.setHours(date.getHours() + offset.hours);
  }
  if (offset.minutes) {
    date.setMinutes(date.getMinutes() + offset.minutes);
  }
  if (offset.seconds) {
    date.setSeconds(date.getSeconds() + offset.seconds);
  }

  return date.getTime();
}
