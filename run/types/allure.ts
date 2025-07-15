// Centralized Allure Reporter configuration for test organization and reporting consistency.

/**
 * Allure Suite Configuration
 *
 * Defines valid parent-suite combinations for organizing tests in Allure reports.
 * Tests with the same suite values will be grouped together, even across different files.
 *
 * Usage in tests:
 * bothPlatformsIt({
 *   title: 'Delete conversation',
 *   testCb: deleteConversation,
 *   allureSuites: {
 *     parent: 'User Actions',
 *     suite: 'Delete Conversation',
 *   },
 * });
 */

export type AllureSuiteConfig =
  | { parent: 'Communities' }
  | { parent: 'Disappearing Messages'; suite: 'Conversation Types' | 'Message Types' | 'Rules' }
  | { parent: 'Groups'; suite: 'Edit Group' }
  | { parent: 'Linkouts' }
  | { parent: 'Sending Messages'; suite: 'Sending Attachments' }
  | { parent: 'Settings'; suite: 'App Disguise' }
  | {
      parent: 'User Actions';
      suite: 'Block/Unblock' | 'Delete Contact' | 'Delete Conversation' | 'Hide Note to Self';
    }
  | { parent: 'Visual Checks' }
  | { parent: 'Voice Calls' };
/**
 * Standardized Test Step Descriptions
 *
 * Provides consistent step naming across all tests for better Allure reporting.
 * Use these constants for common test operations to ensure uniformity.
 *
 * Usage:
 * await test.step(TestSteps.SETUP.QA_SEEDER, async () => { ... });
 *
 * For one-off or unique steps, you can still use string literals:
 * await test.step('Verify custom business logic', async () => { ... });
 */

export const TestSteps = {
  // Setup/teardown steps
  SETUP: {
    NEW_USER: 'Create new account',
    QA_SEEDER: 'Restore pre-seeded accounts',
    CLOSE_APP: 'Close app(s)',
  },
  // Plus Button options
  NEW_CONVERSATION: {
    JOIN_COMMUNITY: 'Join Community',
  },
  // Sending things
  SEND: {
    LINK: 'Send Link',
    IMAGE: 'Send Image',
  },
  // Open/Navigate steps
  OPEN: {
    UPDATE_GROUP_INFO: "Open 'Update Group Information' modal",
  },
  // Disappearing Messages
  DISAPPEARING_MESSAGES: {
    SET_DISAPPEARING_MSG: 'Set Disappearing Messages',
  },
  // Verify steps
  VERIFY: {
    MODAL_STRINGS: 'Verify modal strings',
    MESSAGE_RECEIVED: 'Verify message has been received',
    MESSAGE_DISAPPEARED: 'Verify message disappeared',
  },
};
