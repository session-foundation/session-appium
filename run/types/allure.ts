/**
 * Centralized Allure suite definitions for test organization.
 *
 * Usage in tests:
 * bothPlatformsIt({
    ... rest of the parameters
 *   allureSuites: {
 *     parent: 'User Actions',
 *     suite: 'Delete Conversation',
 *   },
 * });
 *
 * Tests with the same suite values will be grouped together in Allure reports,
 * even if they're in different files. This helps organize test results by feature area.
 */

export type AllureSuiteConfig =
  | { parent: 'Groups'; suite: 'Edit Group' | 'Leave Group' }
  | {
      parent: 'User Actions';
      suite: 'Delete Contact' | 'Delete Conversation' | 'Hide Note to Self';
    };
