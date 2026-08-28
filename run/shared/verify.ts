// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.
// Depends on nothing but Playwright, deliberately — it is imported from both process trees.

import { expect } from '@playwright/test';

/**
 * Wrapper for Playwright's `expect()` that keeps Allure reports clean.
 *
 * Playwright dumps the raw diff into the error message,
 * which can be confusing for report readers.
 *
 * `verify()` catches assertion errors and rethrows with a clean message.
 *
 * @param actual - The value being asserted
 * @param message - Business-readable failure message for reporting
 *
 * @example
 * verify(messages, 'Conversation messages are in the wrong order').toEqual(expected);
 * verify(isVisible, 'Blocked user banner should not be visible').not.toBe(true);
 */
export function verify<T>(actual: T, message: string) {
  const matchers = expect(actual, message);

  function wrapMatchers(obj: typeof matchers): typeof matchers {
    return new Proxy(obj, {
      get(target, prop: string | symbol) {
        const val = Reflect.get(target, prop, target);
        if (prop === 'not' || prop === 'resolves' || prop === 'rejects')
          return wrapMatchers(val as typeof matchers);
        if (typeof val === 'function') {
          return (...args: unknown[]) => {
            const mismatch = () => {
              const lines = [message];
              if (args.length > 0) {
                lines.push(`Expected: ${String(args[0])}`);
                lines.push(`Actual: ${String(actual)}`);
              }
              return new Error(lines.join('\n'));
            };
            try {
              const result = (val as (...a: unknown[]) => unknown).apply(target, args);
              if (result instanceof Promise) {
                return result.catch(() => {
                  throw mismatch();
                });
              }
              return result;
            } catch {
              throw mismatch();
            }
          };
        }
        return val;
      },
    });
  }

  return wrapMatchers(matchers);
}
