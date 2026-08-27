import type { StateUser } from '@session-foundation/qa-seeder';

// Desktop (Electron/Playwright) test types. These are desktop-specific and are kept
// separate from the mobile `run/types/testing.ts` on purpose (different shapes,
// e.g. testid-based selectors). Only used by the desktop driving code under
// `run/desktop/`.
import { Page } from '@playwright/test';

import type { DisappearActions } from '../shared/constants';

export type Group = {
  userName: string;
  userOne: StateUser;
  userTwo: StateUser;
  userThree: StateUser;
};

export type ConversationType = '1:1' | 'community' | 'group' | 'note-to-self';

export type DMTimeOption =
  | 'disappear-off-option'
  | 'input-10-seconds'
  | 'time-option-0-seconds'
  | 'time-option-1-days'
  | 'time-option-1-hours'
  | 'time-option-10-seconds'
  | 'time-option-12-hours'
  | 'time-option-14-days'
  | 'time-option-30-minutes'
  | 'time-option-30-seconds'
  | 'time-option-5-minutes'
  | 'time-option-5-seconds'
  | 'time-option-6-hours'
  | 'time-option-60-seconds'
  | 'time-option-7-days';

type DisappearOpts1o1 = [
  '1:1',
  'disappear-after-read-option' | 'disappear-after-send-option',
  DMTimeOption,
  DisappearActions,
];

type DisappearOptsGroup = [
  'group' | 'note-to-self',
  DisappearGroupType,
  DMTimeOption,
  DisappearActions,
];

export type DisappearOptions = DisappearOpts1o1 | DisappearOptsGroup;
export type DisappearType = 'disappear-after-read-option' | 'disappear-after-send-option';

export type DisappearGroupType = Exclude<DisappearType, 'disappear-after-read-option'>;

export type { DisappearActions };

export type StrategyExtractionObj =
  | {
      strategy: Extract<Strategy, ':has-text' | 'class'>;
      selector: string;
    }
  | {
      strategy: Extract<Strategy, 'data-testid'>;
      selector: DataTestId;
    };

export type WithPage = { window: Page };
export type WithMaxWait = { maxWait?: number };
export type WithRightButton = { rightButton?: boolean };

/**
 * How an attachment is CLASSIFIED for the untrusted-sender prompt, "Click to download {file_type}".
 *
 * A coarser grouping than the kind of file being sent, which is why this is no longer `MediaType`: `ClickToTrustSender` derives
 * it from the first attachment's mime type and can produce exactly three values — `audio` for audio,
 * `media` for BOTH images and videos, and `file` for everything else:
 *
 *     isAudio(mime) ? i18n('audio') : isImageOrVideo(mime) ? i18n('media') : i18n('file')
 *
 * `image` and `video` used to be members and were never reachable. They are the dangerous kind of wrong
 * value: they name real media, so picking one to send a photo reads correctly and then waits out the
 * timeout against copy the app never renders, which reports as a failed download.
 */
export type AttachmentType = 'audio' | 'file' | 'media';
export type Strategy = ':has-text' | 'class' | 'data-testid';
export type MessageStatus = 'failed' | 'read' | 'sent';

export type DataTestId =
  | DMTimeOption
  | 'accept-message-request'
  | 'appearance-settings-menu-item'
  | 'audio-player'
  | 'avatar-edit-profile-dialog'
  | 'avatar-edit-profile-picture-dialog'
  | 'back-button'
  | 'ban-user-confirm-button'
  | 'ban-user-delete-all-confirm-button'
  | 'ban-user-input'
  | 'blocked-contacts-settings-row'
  | 'call-button'
  | 'call-notification-answered-a-call'
  | 'call-notification-started-call'
  | 'change-password-settings-button'
  | 'chooser-invite-friend'
  | 'chooser-new-community'
  | 'chooser-new-conversation-button'
  | 'chooser-new-group'
  | 'classic-dark-themes-settings-menu-item'
  | 'classic-light-themes-settings-menu-item'
  | 'clear-data-settings-menu-item'
  | 'clear-group-info-name-button'
  | 'community-invitation-details'
  | 'contact'
  | 'context-menu-item'
  | 'continue-button'
  | 'continue-session-button'
  | 'control-message'
  | 'conversation-item-pinned'
  | 'conversation-options-avatar'
  | 'conversations-settings-menu-item'
  | 'copy-button-account-id'
  | 'copy-button-profile-update'
  | 'copy-url-button'
  | 'create-account-button'
  | 'create-group-button'
  | 'cta-body'
  | 'cta-cancel-button'
  | 'cta-confirm-button'
  | 'cta-heading'
  | 'decline-and-block-message-request'
  | 'delete-message-request'
  | 'disappear-after-read-option'
  | 'disappear-after-send-option'
  | 'disappear-control-message'
  | 'disappear-messages-type-and-time'
  | 'disappear-set-button'
  | 'disappearing-messages-dropdown'
  | 'disappearing-messages-indicator'
  | 'disappearing-messages-menu-option'
  | 'display-name-input'
  | 'dropdownitem-5-seconds'
  | 'edit-group-name'
  | 'edit-profile-icon'
  | 'empty-conversation-control-message'
  | 'empty-conversation-notification'
  | 'empty-msg-view-account-created'
  | 'empty-msg-view-welcome'
  | 'enable-calls-settings-row'
  | 'enable-communities-message-requests-settings-row'
  | 'enable-microphone-settings-row'
  | 'enable-read-receipts-settings-row'
  | 'end-call'
  | 'end-voice-message'
  | 'error-message'
  | 'existing-account-button'
  | 'group-name'
  | 'group-update-message'
  | 'header-conversation-name'
  | 'hide-recovery-password-settings-button'
  | 'image-upload-click'
  | 'image-upload-section'
  | 'invite-contacts-menu-option'
  | 'join-community-button'
  | 'join-community-conversation'
  | 'label-device_and_network'
  | 'last-updated-timestamp'
  | 'learn-about-staking-link'
  | 'learn-more-network-link'
  | 'leave-group-button'
  | 'leftpane-primary-avatar'
  | 'link-device'
  | 'link-preview-image'
  | 'link-preview-title'
  | 'loading-animation'
  | 'loading-spinner'
  | 'manage-members-menu-option'
  | 'market-cap-amount'
  | 'mentions-container-row'
  | 'mentions-container'
  | 'message-container'
  | 'message-content'
  | 'message-input-text-area'
  | 'message-request-banner'
  | 'message-request-response-message'
  | 'message-requests-settings-menu-item'
  | 'messages-container'
  | 'microphone-button'
  | 'modal-back-button'
  | 'modal-close-button'
  | 'modal-description'
  | 'modal-heading'
  | 'module-contact-name__profile-name'
  | 'module-conversation__user__profile-name'
  | 'module-message__author__profile-name'
  | 'msg-link-preview-title'
  | 'new-closed-group-name'
  | 'new-conversation-button'
  | 'new-session-conversation'
  | 'next-new-conversation-button'
  | 'nickname-input'
  | 'ocean-dark-themes-settings-menu-item'
  | 'ocean-light-themes-settings-menu-item'
  | 'open-url-confirm-button'
  | 'password-input-confirm'
  | 'password-input-reconfirm'
  | 'password-input'
  | 'path-light-container'
  | 'path-light-svg'
  | 'pin-conversation-menu-item'
  | 'privacy-settings-menu-item'
  | 'pro-badge-contact-name'
  | 'pro-badge-conversation-header'
  | 'pro-badge-edit-profile-picture'
  | 'pro-badge-profile-name'
  | 'pro-badge-visible-settings-row'
  | 'pro-badge-visible-settings-toggle'
  | 'pro-message-feature-badges'
  | 'pro-message-feature-longer-messages'
  | 'pro-open-platform-website-button'
  | 'pro-screen-refund-platform-account'
  | 'pro-screen-refund-session-support'
  | 'pro-screen-refund-store-policies'
  | 'pro-settings-description'
  | 'pro-settings-features-header'
  | 'pro-settings-manage-header'
  | 'pro-settings-stats-header'
  | 'pro-settings-status-banner'
  | 'pro-stats-badges-sent'
  | 'pro-stats-longer-messages'
  | 'pro-stats-pinned-conversations'
  | 'profile-name-input'
  | 'quote-text'
  | 'recovery-password-seed-modal'
  | 'recovery-password-settings-menu-item'
  | 'recovery-phrase-input'
  | 'refresh-button'
  | 'renew-pro-button'
  | 'request-refund-button'
  | 'restore-using-recovery'
  | 'reveal-recovery-phrase'
  | 'save-button-profile-update'
  | 'scroll-to-bottom-button'
  | 'search-input'
  | 'send-message-button'
  | 'sent-price'
  | 'session-confirm-cancel-button'
  | 'session-confirm-ok-button'
  | 'session-id-signup'
  | 'session-network-settings-menu-item'
  | 'session-pro-settings-menu-item'
  | 'session-recovery-password'
  | 'session-toast'
  | 'set-nickname-confirm-button'
  | 'set-password-button'
  | 'set-password-settings-button'
  | 'settings-section'
  | 'staged-attachments-container'
  | 'staking-reward-pool-amount'
  | 'swarm-image'
  | 'theme-section'
  | 'tooltip-character-count'
  | 'unban-user-confirm-button'
  | 'unban-user-input'
  | 'unblock-button-settings-screen'
  | 'update-access-settings-sub-text'
  | 'update-group-info-name-input'
  | 'update-profile-info-name-input'
  | 'your-account-id'
  | 'your-profile-name'
  | 'your-swarm-amount'
  | `cta-list-item-${number}`
  | `input-${DMTimeOption}`;

export type ModalId =
  | 'blockOrUnblockModal'
  | 'confirmModal'
  | 'deleteAccountModal'
  | 'hideRecoveryPasswordModal'
  | 'openUrlModal'
  | 'userSettingsModal';
