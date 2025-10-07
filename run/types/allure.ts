import { UserNameType } from '@session-foundation/qa-seeder';

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
  | { parent: 'Disappearing Messages'; suite: 'Conversation Types' | 'Message Types' | 'Rules' }
  | { parent: 'Groups'; suite: 'Edit Group' }
  | { parent: 'In-App Review Prompt'; suite: 'Flows' | 'Triggers' }
  | { parent: 'Linkouts' }
  | { parent: 'New Conversation'; suite: 'Join Community' | 'New Message' }
  | { parent: 'Sending Messages'; suite: 'Attachments' | 'Emoji reacts' }
  | { parent: 'Settings'; suite: 'App Disguise' }
  | {
      parent: 'User Actions';
      suite:
        | 'Block/Unblock'
        | 'Change Profile Picture'
        | 'Delete Contact'
        | 'Delete Conversation'
        | 'Delete Message'
        | 'Hide Note to Self'
        | 'Set Nickname'
        | 'Share to Session';
    }
  | { parent: 'Visual Checks'; suite: 'Conversation' | 'Onboarding' | 'Settings' }
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
    NEW_MESSAGE: 'New Message',
    JOIN_COMMUNITY: 'Join Community',
  },
  // Sending things
  SEND: {
    MESSAGE: (sender: UserNameType, recipient: string) =>
      `${sender} sends a message to ${recipient}`,
    REPLY: (sender: UserNameType, recipient: string) => `${sender} replies to ${recipient}`,
    LINK: 'Send Link',
    IMAGE: 'Send Image',
    EMOJI_REACT: `Send an emoji react`,
  },
  // Open/Navigate steps
  OPEN: {
    GENERIC: (string: string) => `Open ${string}`,
    NTS: 'Open Note to Self',
    UPDATE_GROUP_INFO: `Open 'Update Group Information' modal`,
    PATH: 'Open Path screen',
    APPEARANCE: 'Open Appearance settings',
  },
  // User Actions
  USER_ACTIONS: {
    CHANGE_PROFILE_PICTURE: 'Change profile picture',
    APP_DISGUISE: 'Set App Disguise',
    DELETE_FOR_EVERYONE: 'Delete for everyone',
  },
  // Disappearing Messages
  DISAPPEARING_MESSAGES: {
    SET: (time: string) => `Set Disappearing Messages (${time})`,
  },
  CALLS: {
    INITIATE_CALL: (userName: UserNameType) => `${userName} initiates voice call`,
    ACCEPT_PERMS: (userName: UserNameType) => `${userName} accepts voice call permissions`,
  },
  // Verify steps
  VERIFY: {
    SCREENSHOT: (desc: string) => `Verify ${desc} screenshot matches baseline`,
    GENERIC_MODAL: 'Verify modal strings',
    SPECIFIC_MODAL: (modalDesc: string) => `Verify ${modalDesc} modal strings`,
    MESSAGE_SYNCED: 'Verify message synced to linked device',
    MESSAGE_RECEIVED: 'Verify message has been received',
    MESSAGE_DISAPPEARED: 'Verify message disappeared',
    MESSAGE_DELETED: (context: string) => `Verify message deleted in/on ${context}`,
    DISAPPEARING_CONTROL_MESSAGES: 'Verify the disappearing control messages for each user',
    CALLING: 'Verify call has been started',
    CALL_SUCCESSFUL: 'Verify call has been put through successfully',
    MISSED_CALL: 'Verify missed call',
    NICKNAME_CHANGED: (context: string) => `Verify nickname changed in/on ${context}`,
    PROFILE_PICTURE_CHANGED: 'Verify profile picture has been changed',
    EMOJI_REACT: 'Verify emoji react appears for everyone',
  },
};
