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
const MARKED_MESSAGE_LENGTH = PRO_MAX_CHARS - COUNTDOWN_START_THRESHOLD;

/** Where the `LATE` marker sits, quoted when a spec reports a limit that was wrongly honoured. */
export const LATE_AT = STANDARD_MAX_CHARS + 500;

const EARLY_AT = 500;

export const early = (tag: string) => `EARLY-${tag}`;
export const late = (tag: string) => `LATE-${tag}`;

/** One character past the largest body the product allows anyone to send. */
export const OVER_PRO_LIMIT_CHARS = PRO_MAX_CHARS + 1;

/** Marker whose LAST character sits at exactly `PRO_MAX_CHARS`, so a copy cut there still holds it. */
export const boundary = (tag: string) => `BOUNDARY-${tag}`;

/** `boundary` plus the one character past the limit — the only thing telling 10,000 from 10,001 apart. */
export const overflow = (tag: string) => `${boundary(tag)}Z`;

/** A body of exactly `length` characters, filled with a single repeated character. */
export function messageOfLength(length: number, fill: string = 'x'): string {
  return fill.repeat(length);
}

/** A body past the standard limit, so only a client applying the Pro limit can send it. */
export function overStandardLengthMessage(tag?: string): string {
  const body = messageOfLength(OVER_STANDARD_CHARS);
  return tag ? `${tag} ${body.slice(tag.length + 1)}` : body;
}

/** A marker and the index its first character must land on. */
type Marker = { text: string; startsAt: number };

/** Distinct per region, so a page-source dump says which stretch of the body you are looking at. */
const REGION_FILL = 'abcdefghijklmnopqrstuvwxyz';

/**
 * A body of exactly `length` characters with each marker starting at the index asked for.
 *
 * The placement is **proved, not trusted**, because getting it wrong fails in the flattering
 * direction: a marker that was never planted reads as a recipient that dropped it, so the spec would
 * report a client bug that is really an arithmetic slip here.
 */
function bodyWithMarkers(what: string, length: number, markers: Array<Marker>): string {
  const ordered = [...markers].sort((a, b) => a.startsAt - b.startsAt);

  let body = '';
  ordered.forEach(({ text, startsAt }, region) => {
    if (startsAt < body.length) {
      throw new Error(
        `${what}: "${text}" starts at ${startsAt}, inside the marker before it which ends at ${body.length}.`
      );
    }
    body += REGION_FILL[region % REGION_FILL.length].repeat(startsAt - body.length) + text;
  });

  if (body.length > length) {
    throw new Error(
      `${what}: the markers reach ${body.length} characters, past the ${length} asked for.`
    );
  }
  body += REGION_FILL[ordered.length % REGION_FILL.length].repeat(length - body.length);

  if (body.length !== length) {
    throw new Error(`${what}: built ${body.length} characters, wanted ${length}.`);
  }
  for (const { text, startsAt } of ordered) {
    const at = body.indexOf(text);
    if (at !== startsAt) {
      throw new Error(`${what}: "${text}" landed at ${at}, wanted ${startsAt}.`);
    }
    if (body.lastIndexOf(text) !== at) {
      throw new Error(
        `${what}: "${text}" appears more than once, so a probe for it cannot say where the copy was cut.`
      );
    }
  }

  return body;
}

/**
 * The pair both bodies open with, and the reason they are a pair.
 *
 * `EARLY` ends inside the standard limit, so it survives every outcome including a truncated copy. It
 * is the anchor: without it, "the tail is missing" is equally well explained by the message never
 * arriving, and the assertion would pass before the behaviour under test happened. `LATE` starts past
 * the standard limit and inside the Pro one, so it survives only if the recipient honoured the proof.
 *
 * Checked rather than assumed because both offsets grow with the tag.
 */
function straddlingMarkers(what: string, tag: string): Array<Marker> {
  const earlyEnd = EARLY_AT + early(tag).length;
  if (earlyEnd > STANDARD_MAX_CHARS || LATE_AT <= STANDARD_MAX_CHARS) {
    throw new Error(
      `${what}: EARLY ends ${earlyEnd} and LATE starts ${LATE_AT} \u2014 they must straddle the standard ` +
        `limit of ${STANDARD_MAX_CHARS}.`
    );
  }

  return [
    { text: early(tag), startsAt: EARLY_AT },
    { text: late(tag), startsAt: LATE_AT },
  ];
}

/** A Pro-length body whose two markers say which limit the recipient applied. */
export function markedMessage(tag: string): string {
  const what = `markedMessage(${tag})`;

  return bodyWithMarkers(what, MARKED_MESSAGE_LENGTH, straddlingMarkers(what, tag));
}

/**
 * A body of exactly `OVER_PRO_LIMIT_CHARS`, marked so a recipient's copy can be pinned to an exact
 * length without reading its text.
 *
 * Four probes, and each rules out one outcome:
 *   - `early` ends inside the standard limit, so it is present in every copy that arrived at all.
 *   - `late` starts past it, so its absence is a copy cut at the standard limit \u2014 a proof that did not
 *     verify.
 *   - `boundary` ENDS at exactly `PRO_MAX_CHARS`, so its absence is a copy cut short of the Pro limit.
 *   - `overflow` is `boundary` plus the 10,001st character, so its presence is a copy that was not cut.
 *
 * `boundary` present and `overflow` absent means the body ends at exactly `PRO_MAX_CHARS` \u2014 there is
 * one character between the two outcomes, which no marker can straddle and only this pair can pin.
 *
 * Substring probes rather than a length read because the length is not readable on either platform: a
 * desktop bubble carries its "Read more" label inside the same element as the text, and a mobile
 * bubble's accessibility value is the platform's rendering of the body rather than the body.
 *
 * **Plain ASCII, deliberately.** All three clients truncate by code point, but only since session-ios
 * #768 \u2014 before it iOS counted UTF-16 units, so a non-BMP body landed at 10,000 on Android/Desktop and
 * 5,000 on iOS. A spec that wants the non-BMP case should say so explicitly rather than inherit it.
 */
export function overProLimitMessage(tag: string): string {
  const what = `overProLimitMessage(${tag})`;

  return bodyWithMarkers(what, OVER_PRO_LIMIT_CHARS, [
    ...straddlingMarkers(what, tag),
    // Planting `overflow` rather than `boundary` puts `boundary`'s last character on PRO_MAX_CHARS and
    // the surplus one immediately after it, which is the whole measurement.
    { text: overflow(tag), startsAt: PRO_MAX_CHARS - boundary(tag).length },
  ]);
}
