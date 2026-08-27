import { enSimpleNoArgs } from '../localizer/lib/generated/english';

/**
 * A localized string split into the runs of text either side of its `<br/>` breaks.
 *
 * **This exists because `tStripped` cannot be asserted against copy containing a break.** It collapses
 * each `<br/>` to a single space, while every client renders one as no character at all - so the whole
 * stripped string is a run of text that exists nowhere in the UI, and matching it always fails against
 * copy that is present and correct. The desktop refund specs sidestep it by only ever asserting tokens
 * that happen to have no breaks; this is for the ones that do.
 *
 * Returns each run stripped of markup and whitespace-normalised, in order, with empties dropped. Assert
 * a run, never the whole string. Note the runs of two related tokens are often shared - the two
 * clear-data warnings differ only in their first - so which run you pick decides what the assertion
 * actually pins down.
 *
 * `enSimpleNoArgs` only: a token taking arguments has to go through the localizer to be interpolated,
 * and none of the copy that needs this takes any.
 */
export function localizedRuns(token: keyof typeof enSimpleNoArgs): Array<string> {
  return enSimpleNoArgs[token]
    .split(/<br\s*\/?>/i)
    .map(run =>
      run
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(run => run.length > 0);
}

/**
 * One run by index, or a clear failure rather than `undefined` reaching a locator - where it would read
 * as "element not found" and send the reader looking at the app instead of at the token.
 */
export function localizedRun(token: keyof typeof enSimpleNoArgs, index: number): string {
  const runs = localizedRuns(token);
  const run = runs[index];
  if (run === undefined) {
    throw new Error(
      `localizedRun: "${token}" has ${runs.length} run(s) either side of its <br/> breaks, so there ` +
        `is no run ${index}. Its copy is likely no longer split the way this assertion assumes.`
    );
  }
  return run;
}
