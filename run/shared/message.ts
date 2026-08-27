import { COUNTDOWN_START_THRESHOLD, PRO_MAX_CHARS, STANDARD_MAX_CHARS } from './constants';

/**
 * Message bodies built to a length, shared by every platform.
 *
 * Here rather than in a spec or a feature-specific module because the lengths are a property of the
 * product's limits, not of whatever is being tested: a spec that rolls its own `'x'.repeat(N)` picks a
 * number that stops meaning anything the moment a limit moves.
 */

/** Past the standard limit, so which limit was applied is visible in whether it sent. */
export const OVER_STANDARD_CHARS = 3000;

/** The largest length the composer accepts without sitting on the boundary. */
export const MARKED_MESSAGE_LENGTH = PRO_MAX_CHARS - COUNTDOWN_START_THRESHOLD;

/** Where the `LATE` marker sits, quoted when a spec reports a limit that was wrongly honoured. */
export const LATE_AT = STANDARD_MAX_CHARS + 500;

const EARLY_AT = 500;

export const early = (tag: string) => `EARLY-${tag}`;
export const late = (tag: string) => `LATE-${tag}`;

/** A body of exactly `length` characters, filled with a single repeated character. */
export function messageOfLength(length: number, fill: string = 'x'): string {
  return fill.repeat(length);
}

/** A body past the standard limit, so only a client applying the Pro limit can send it. */
export function overStandardLengthMessage(tag?: string): string {
  const body = messageOfLength(OVER_STANDARD_CHARS);
  return tag ? `${tag} ${body.slice(tag.length + 1)}` : body;
}

/**
 * A Pro-length message carrying two markers, placed so each end's copy is identified by which survives.
 *
 * `EARLY` sits inside the standard limit, so it is present in every outcome — including a copy that
 * arrived truncated. It is the anchor: without it, "the tail is missing" is equally well explained by the
 * message never arriving, and the assertion would pass before the behaviour under test happened.
 *
 * `LATE` sits past the standard limit and inside the Pro one, so it survives only if the recipient
 * honoured the proof.
 *
 * The positions are checked rather than trusted, because getting them wrong fails in the flattering
 * direction: a message that never contained its `EARLY` marker fails as a long wait on the recipient,
 * which reads as a delivery problem.
 */
export function markedMessage(tag: string): string {
  const head = 'a'.repeat(EARLY_AT) + early(tag);
  const withLate = head + 'b'.repeat(LATE_AT - head.length) + late(tag);
  const message = withLate + 'c'.repeat(MARKED_MESSAGE_LENGTH - withLate.length);

  const earlyEnd = message.indexOf(early(tag)) + early(tag).length;
  const lateStart = message.indexOf(late(tag));
  if (
    message.length !== MARKED_MESSAGE_LENGTH ||
    earlyEnd > STANDARD_MAX_CHARS ||
    lateStart <= STANDARD_MAX_CHARS
  ) {
    throw new Error(
      `markedMessage(${tag}): ${message.length} chars, EARLY ends ${earlyEnd}, LATE starts ${lateStart} ` +
        `— the markers must straddle the standard limit of ${STANDARD_MAX_CHARS}.`
    );
  }

  return message;
}
