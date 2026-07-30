import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { endLogGroup, startLogGroup, supportsLogGroups } from '../shared/ci_log_groups';

/**
 * Wraps each test's output in a collapsible GitHub Actions group, titled with its result.
 *
 * The run is otherwise a flat stream of thousands of lines in which the only interesting content —
 * which test ran, whether it passed, how long it took — is buried. This makes the collapsed view one
 * line per test, with that test's logs and error underneath it.
 *
 * **Must be listed before the reporter whose output it groups.** Playwright calls reporters in array
 * order, so this one's `onTestEnd` runs first and opens the group; the base reporter then prints its
 * "Finished test …" block plus any buffered stdout/stderr, which lands inside. The group is closed by
 * the *next* `onTestEnd` (or `onEnd`), since there is no hook that fires after every other reporter
 * has handled a given test.
 *
 * Grouping at test *end* rather than test *begin* is what makes this work at 12 workers: concurrent
 * tests interleave while running, but a result and its buffered output are complete and contiguous by
 * the time `onTestEnd` fires.
 *
 * Emits nothing outside GitHub Actions, so local runs are unchanged.
 */
class CiGroupReporter implements Reporter {
  private groupOpen = false;

  /** Lets Playwright know this reporter writes to stdout, so it doesn't suppress it. */
  printsToStdio(): boolean {
    return supportsLogGroups();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!supportsLogGroups()) {
      return;
    }

    // Close the previous test's group before opening this one — groups don't nest, so an unclosed
    // group would absorb everything that follows.
    if (this.groupOpen) {
      endLogGroup();
    }

    const attempts = test.results.length;
    const statuses = test.results.map(r => r.status).join(', ');
    const durations = test.results.map(r => `${Math.round(r.duration / 1000)}s`).join(', ');
    // A marker in the title so the outcome is readable while collapsed; Actions renders no colour on
    // the group header itself.
    const marker = result.status === 'passed' ? 'PASS' : result.status.toUpperCase();

    startLogGroup(
      `${marker}  ${test.title}: run ${attempts}, statuses: [${statuses}], durations: [${durations}]`
    );
    this.groupOpen = true;
  }

  onEnd(): void {
    if (supportsLogGroups() && this.groupOpen) {
      endLogGroup();
      this.groupOpen = false;
    }
  }
}

export default CiGroupReporter;
