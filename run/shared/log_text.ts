/**
 * Shorten a value for a log line, keeping both ends.
 *
 * Head-and-tail rather than a plain prefix: the reason to read one of these lines is usually to
 * see whether the value is the one you expected, and a 10k-character message body differs from
 * its neighbours at the end as often as at the start. A prefix-only trim turns the message-length
 * specs into thousands of identical `zzzz…` lines.
 */
export function ellipsizeForLog(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const half = Math.floor(maxLength / 2);
  return `${value.substring(0, half)}…${value.substring(value.length - half)}`;
}

/** Locator selectors: long enough to keep a testid plus its text filter readable. */
export const MAX_SELECTOR_LOG_LENGTH = 80;

/** Message bodies, labels and other caller-supplied copy. */
export const MAX_TEXT_LOG_LENGTH = 100;
