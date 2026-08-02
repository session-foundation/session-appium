/**
 * GitHub Actions log grouping.
 *
 * `::group::` / `::endgroup::` render as collapsible sections in the Actions UI, which is the only
 * way to make a run readable *while it streams* — a pass emits thousands of lines and the interesting
 * part is one line per test.
 *
 * Two constraints shape every use of this:
 *
 * 1. **Groups do not nest.** A second `::group::` before the first is closed ends the first rather
 *    than nesting inside it. So exactly one layer of the log may be grouped, and the layer we pick is
 *    per-test (plus the one-off WDA build) — the tiered workflow deliberately does *not* group its
 *    passes, or nothing inside them could be grouped.
 * 2. **The log is one interleaved stream.** At 12 workers, output from concurrent tests arrives
 *    mixed, so a group can only be emitted around output that is already complete. That is why the
 *    grouping reporter opens a group at `onTestEnd` (when the result and its buffered output exist)
 *    rather than at `onTestBegin`.
 *
 * Outside Actions these emit nothing, so local output is unchanged.
 */

/** Actions sets GITHUB_ACTIONS; CI alone is not enough since the markers only mean anything there. */
export const supportsLogGroups = (): boolean => process.env.GITHUB_ACTIONS === 'true';

export function startLogGroup(title: string): void {
  if (supportsLogGroups()) {
    // Newline first: an unterminated line from previous output would otherwise swallow the marker.
    process.stdout.write(`\n::group::${title}\n`);
  }
}

export function endLogGroup(): void {
  if (supportsLogGroups()) {
    process.stdout.write('\n::endgroup::\n');
  }
}

/** Runs `fn` inside a group, closing it even if `fn` throws. */
export function withLogGroup<T>(title: string, fn: () => T): T {
  startLogGroup(title);
  try {
    return fn();
  } finally {
    endLogGroup();
  }
}
