import { USERNAME as usernameFromSeeder, UserNameType } from '@session-foundation/qa-seeder';

import { DeviceWrapper } from './DeviceWrapper';

export type User = {
  userName: UserNameType;
  accountID: string;
  recoveryPhrase: string;
};

export const USERNAME = usernameFromSeeder;

export type GROUPNAME =
  | 'Disappear after send test'
  | 'Disappear after sent test'
  | 'Group to test adding contact'
  | 'Kick member'
  | 'Leave group'
  | 'Leave group linked device'
  | 'Linked device group'
  | 'Mentions test group'
  | 'Message checks for groups'
  | 'Restore group'
  | 'Test group'
  | 'Testing disappearing messages'
  | 'Testing voice';

export type Group = {
  userName: GROUPNAME;
  userOne: User;
  userTwo: User;
  userThree: User;
};

export type SetupData = {
  device1: DeviceWrapper | undefined;
  device2: DeviceWrapper | undefined;
  device3: DeviceWrapper | undefined;
  alice: User | undefined;
  bob: User | undefined;
};

export type Coordinates = {
  x: number;
  y: number;
};

export const InteractionPoints: Record<string, Coordinates> = {
  BackToSession: { x: 42, y: 42 },
};

export type Strategy = '-android uiautomator' | 'accessibility id' | 'class name' | 'id' | 'xpath';

export type ConversationType = '1:1' | 'Community' | 'Group' | 'Note to Self';

export type DisappearModes = 'read' | 'send';
export type DisappearActions = 'read' | 'sent';

export enum DISAPPEARING_TIMES {
  FIVE_SECONDS = '5 seconds',
  TEN_SECONDS = '10 seconds',
  THIRTY_SECONDS = '30 seconds',
  ONE_MINUTE = '1 minute',
  FIVE_MINUTES = '5 minutes',
  THIRTY_MINUTES = '30 minutes',
  ONE_HOUR = '1 hour',
  TWELVE_HOURS = '12 hours',
  ONE_DAY = '1 day',
  ONE_WEEK = '1 week',
  TWO_WEEKS = '2 weeks',
  OFF_IOS = 'Off',
  OFF_ANDROID = 'Disable disappearing messages',
}

export type DisappearingOptions = `Disappear after ${DisappearModes} option`;

export type DisappearOpts1o1 = [
  '1:1',
  `Disappear after ${DisappearModes} option`,
  DISAPPEARING_TIMES,
];

export type DisappearOptsGroup = [
  'Group' | 'Note to Self',
  `Disappear after ${DisappearModes} option`,
  DISAPPEARING_TIMES,
];

export type MergedOptions = DisappearOpts1o1 | DisappearOptsGroup;

export type StrategyExtractionObj =
  | {
      strategy: Extract<Strategy, '-android uiautomator'>;
      selector: UiAutomatorQuery;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'accessibility id'>;
      selector: AccessibilityId;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'class name'>;
      selector: string;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'DMTimeOption'>;
      selector: DISAPPEARING_TIMES;
    }
  | {
      strategy: Extract<Strategy, 'id'>;
      selector: Id;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'xpath'>;
      selector: XPath;
      text?: string;
    };

export type XPath =
  | '//XCUIElementTypeCell'
  | `(//android.widget.ImageView[@resource-id="network.loki.messenger:id/thumbnail"])[1]`
  | `(//XCUIElementTypeImage[@name="gif cell"])[1]`
  | `//*[./*[@name='${DISAPPEARING_TIMES}']]/*[2]`
  | `//*[@resource-id='network.loki.messenger:id/callTitle' and contains(@text, ':')]`
  | `//*[starts-with(@content-desc, "Photo taken on")]`
  | `//android.view.ViewGroup[@resource-id='network.loki.messenger:id/mainContainer'][.//android.widget.TextView[contains(@text,'${string}')]]//androidx.compose.ui.platform.ComposeView[@resource-id='network.loki.messenger:id/profilePictureView']`
  | `//android.view.ViewGroup[@resource-id="network.loki.messenger:id/mainContainer"][.//android.widget.TextView[contains(@text,"${string}")]]//android.view.ViewGroup[@resource-id="network.loki.messenger:id/layout_emoji_container"]`
  | `//android.view.ViewGroup[@resource-id="network.loki.messenger:id/mainContainer"][.//android.widget.TextView[contains(@text,"${string}")]]//android.widget.TextView[@resource-id="network.loki.messenger:id/reactions_pill_count"][@text="${string}"]`
  | `//android.widget.LinearLayout[.//android.widget.TextView[@content-desc="Conversation list item" and @text="${string}"]]//android.widget.TextView[@resource-id="network.loki.messenger:id/snippetTextView" and @text="${string}"]`
  | `//android.widget.TextView[@text="${string}"]`
  | `//android.widget.TextView[@text="Message"]/parent::android.view.View`
  | `//XCUIElementTypeAlert//*//XCUIElementTypeButton`
  | `//XCUIElementTypeButton[@name="Continue"]`
  | `//XCUIElementTypeButton[@name="Okay"]`
  | `//XCUIElementTypeButton[@name="Settings"]`
  | `//XCUIElementTypeCell[.//XCUIElementTypeOther[@label="${string}"]]//XCUIElementTypeStaticText[@value="😂"]`
  | `//XCUIElementTypeCell[.//XCUIElementTypeOther[@label="${string}"]]//XCUIElementTypeStaticText[@value="${string}"]`
  | `//XCUIElementTypeCell[.//XCUIElementTypeOther[@name='Message body' and contains(@label,'${string}')]]//XCUIElementTypeStaticText[contains(@value,'(15')]`
  | `//XCUIElementTypeCell[@name="${string}"]`
  | `//XCUIElementTypeCell[@name="Conversation list item" and @label="${string}"]//XCUIElementTypeStaticText[@name="${string}"]`
  | `//XCUIElementTypeCell[@name="Session"]`
  | `//XCUIElementTypeImage`
  | `//XCUIElementTypeOther[contains(@name, "Hey,")][1]`
  | `//XCUIElementTypeStaticText[@name="${string}"]`
  | `//XCUIElementTypeStaticText[@name="Paste"]`
  | `//XCUIElementTypeStaticText[@name="Videos"]`
  | `//XCUIElementTypeStaticText[contains(@name, '00:')]`
  | `//XCUIElementTypeStaticText[contains(@name, "Version")]`
  | `//XCUIElementTypeStaticText[starts-with(@name,'${string}')]`
  | `//XCUIElementTypeSwitch[@name="Read Receipts, Send read receipts in one-to-one chats."]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout[2]/android.widget.Button[1]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ListView/android.widget.LinearLayout`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.view.ViewGroup/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.LinearLayout[5]/android.widget.RelativeLayout/android.widget.TextView[2]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.RelativeLayout/android.widget.ScrollView/androidx.viewpager.widget.ViewPager/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.FrameLayout[1]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/androidx.appcompat.widget.LinearLayoutCompat/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.TextView[2]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.TabHost/android.widget.LinearLayout/android.widget.FrameLayout/androidx.viewpager.widget.ViewPager/android.widget.RelativeLayout/android.widget.GridView/android.widget.LinearLayout/android.widget.LinearLayout[2]`;

export type UiAutomatorQuery =
  | 'new UiSelector().resourceId("cta-button-negative").childSelector(new UiSelector().className("android.widget.TextView"))'
  | 'new UiSelector().resourceId("cta-button-positive").childSelector(new UiSelector().className("android.widget.TextView"))'
  | 'new UiSelector().resourceId("network.loki.messenger:id/messageStatusTextView").text("Sent")'
  | 'new UiSelector().text("Enter your display name")'
  | `new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId(${string}))`
  | `new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text(${string}))`
  | `new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().textStartsWith(${string}))`
  | `new UiSelector().resourceId("Conversation header name").childSelector(new UiSelector().resourceId("pro-badge-text"))`
  | `new UiSelector().text(${string})`;

export type AccessibilityId =
  | DISAPPEARING_TIMES
  | UserNameType
  | '😂'
  | '2'
  | 'Accept message request'
  | 'Accept name change'
  | 'Account ID'
  | 'Add'
  | 'Add members'
  | 'Albums'
  | 'Allow'
  | 'Allow Access to All Photos'
  | 'Allow Full Access'
  | 'Allow voice and video calls'
  | 'All Photos'
  | 'Answer call'
  | 'Appearance'
  | 'Apply'
  | 'Apply changes'
  | 'Attachments button'
  | 'Awaiting Recipient Answer... 4/6'
  | 'back'
  | 'Back'
  | 'Blinded ID'
  | 'Block'
  | 'Block contacts - Navigation'
  | 'blocked-banner'
  | 'Blocked banner'
  | 'Block message request'
  | 'Browse'
  | 'Call'
  | 'Call button'
  | 'Cancel'
  | 'Classic Light'
  | 'Clear'
  | 'Clear all'
  | 'Close'
  | 'Close button'
  | 'Community invitation'
  | 'Community Message Requests'
  | 'Configuration message'
  | 'Confirm'
  | 'Confirm block'
  | 'Confirm delete'
  | 'Confirm invite button'
  | 'Confirm leave'
  | 'Contact'
  | 'Contact mentions'
  | 'Contact status'
  | 'Continue'
  | 'Continue button'
  | 'Continue with settings'
  | 'Control message'
  | 'Conversation header name'
  | 'Conversation list item'
  | 'Conversations'
  | 'Copy'
  | 'Copy button'
  | 'Copy URL'
  | 'Create account button'
  | 'Create group'
  | 'Decline message request'
  | 'Delete'
  | 'Delete Contact'
  | 'Delete Conversation'
  | 'Deleted message'
  | 'Delete for everyone'
  | 'Delete for me'
  | 'Delete group'
  | 'Delete just for me'
  | 'Delete message'
  | 'Delete message request'
  | 'Delete on this device only'
  | 'Description'
  | 'Details'
  | 'Disable disappearing messages'
  | 'Disappear after read option'
  | 'Disappear after send option'
  | 'Disappearing Messages'
  | 'Disappearing messages'
  | 'Disappearing messages time picker'
  | 'Disappearing messages type and time'
  | 'Display name'
  | 'Document'
  | 'Documents folder'
  | 'Don’t Allow'
  | 'Donate'
  | 'Done'
  | 'Download'
  | 'Download media'
  | 'Downloads'
  | 'Edit'
  | 'Edit group'
  | 'Edit group name'
  | 'Edit user nickname'
  | 'Empty list'
  | 'Empty state label'
  | 'Enable'
  | 'End call button'
  | 'enjoy-session-negative-button'
  | 'enjoy-session-positive-button'
  | 'Enter Community URL'
  | 'Enter display name'
  | 'Error message'
  | 'Fast mode notifications button'
  | 'Follow setting'
  | 'GIF button'
  | 'Group description text field'
  | 'Group name'
  | 'Group name input'
  | 'Group name text field'
  | 'Hide'
  | 'Hide Note to Self'
  | 'Hide recovery password button'
  | 'Hide Recovery Password Permanently'
  | 'Image picker'
  | 'Images folder'
  | 'Invite'
  | 'Invite button'
  | 'Invite Contacts'
  | 'Invite contacts button'
  | 'Invite friend button'
  | 'Join'
  | 'Join Community'
  | 'Join community'
  | 'Join community button'
  | 'Join community option'
  | 'Last updated timestamp'
  | 'Learn about staking link'
  | 'Learn more link'
  | 'Leave'
  | 'Leave group'
  | 'Legacy group banner'
  | 'Legacy Groups Recreate Button'
  | 'Link Device'
  | 'Link preview'
  | 'Loading animation'
  | 'Local Network Permission - Switch'
  | 'Manage Members'
  | 'Market cap amount'
  | 'Maybe Later'
  | 'Media message'
  | 'MeetingSE'
  | 'Meetings option'
  | 'Mentions list'
  | 'Message'
  | 'Message body'
  | 'Message composition'
  | 'Message input box'
  | 'Message Notifications'
  | 'Message request'
  | 'Message requests banner'
  | 'Message sent status: Failed to send'
  | 'Message sent status: Read'
  | 'Message sent status: Sending'
  | 'Message sent status: Sent'
  | 'Message sent status'
  | 'Message user'
  | 'Modal description'
  | 'Modal heading'
  | 'More options'
  | 'Navigate up'
  | 'New conversation button'
  | 'New direct message'
  | 'New voice message'
  | 'Next'
  | 'Nickname'
  | 'No'
  | 'No pending message requests'
  | 'not-now-button'
  | 'Note to Self'
  | 'Notifications'
  | 'Off'
  | 'OK_BUTTON'
  | 'OK'
  | 'Okay'
  | 'open-survey-button'
  | 'Open'
  | 'Open URL'
  | 'Path'
  | 'Photo library'
  | 'Photos'
  | 'Pin'
  | 'Please enter a shorter group name'
  | 'Privacy Policy'
  | 'qa-blocked-contacts-settings-item'
  | 'rate-app-button'
  | 'Read Receipts - Switch'
  | 'Recents'
  | 'Recovery password'
  | 'Recovery password container'
  | 'Recovery password input'
  | 'Recovery password menu item'
  | 'Recovery phrase input'
  | 'Recovery phrase reminder'
  | 'Remove'
  | 'Remove contact button'
  | 'Replace'
  | 'Reply to message'
  | 'Restore your session button'
  | 'Reveal recovery phrase button'
  | 'Ringing...'
  | 'Save'
  | 'Save button'
  | 'Save to Files'
  | 'Scroll button'
  | 'Search button'
  | 'Search icon'
  | 'Select'
  | 'Select alternate app icon'
  | 'Send'
  | 'Send message button'
  | 'SENT price'
  | 'Session'
  | 'Session | Send Messages, Not Metadata. | Private Messenger'
  | 'Session ID generated'
  | 'Session id input box'
  | 'Session Network'
  | 'Set'
  | 'Set button'
  | 'Settings'
  | 'Share'
  | 'Share button'
  | 'ShareButton'
  | 'Show'
  | 'Show Note to Self'
  | 'Show roots'
  | 'Slow mode notifications button'
  | 'space'
  | 'Staking reward pool amount'
  | 'TabBarItemTitle'
  | 'Terms of Service'
  | 'test_file, pdf'
  | 'Time selector'
  | 'Unblock'
  | 'Untrusted attachment message'
  | 'Upload'
  | 'URL'
  | 'Username'
  | 'Username input'
  | 'User settings'
  | 'Version warning banner'
  | 'Videos'
  | 'Voice and Video Calls - Switch'
  | 'Voice message'
  | 'X'
  | 'Yes'
  | 'You have changed the icon for “Session”.'
  | 'Your message request has been accepted.'
  | `${DISAPPEARING_TIMES} - Radio`
  | `${GROUPNAME}`
  | `Disappear after ${DisappearActions} option`;

export type Id =
  | DISAPPEARING_TIMES
  | 'account-id'
  | 'Account ID'
  | 'android:id/aerr_close'
  | 'android:id/aerr_wait'
  | 'android:id/alertTitle'
  | 'android:id/content_preview_text'
  | 'android:id/summary'
  | 'android:id/title'
  | 'android.widget.TextView'
  | 'Appearance'
  | 'block-user-confirm-button'
  | 'block-user-menu-option'
  | 'Block'
  | 'Call'
  | 'clear-input-button-description'
  | 'clear-input-button-name'
  | 'clear-input-button'
  | 'Close button'
  | 'com.android.chrome:id/negative_button'
  | 'com.android.chrome:id/signin_fre_dismiss_button'
  | 'com.android.chrome:id/url_bar'
  | 'com.android.permissioncontroller:id/permission_allow_all_button'
  | 'com.android.permissioncontroller:id/permission_allow_button'
  | 'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  | 'com.android.permissioncontroller:id/permission_deny_button'
  | 'com.android.settings:id/switch_text'
  | 'com.google.android.apps.photos:id/sign_in_button'
  | 'Community input'
  | 'Confirm'
  | 'Confirm invite button'
  | 'Contact'
  | 'Contact status'
  | 'Continue'
  | 'conversation-options-avatar'
  | 'Conversation header name'
  | 'Conversations'
  | 'Copy button'
  | 'Copy URL'
  | 'Create account button'
  | 'Create group'
  | 'cta-body'
  | 'cta-button-negative'
  | 'cta-button-positive'
  | 'delete-contact-confirm-button'
  | 'delete-contact-menu-option'
  | 'delete-conversation-confirm-button'
  | 'delete-conversation-menu-option'
  | 'delete-for-everyone'
  | 'delete-group-confirm-button'
  | 'delete-group-menu-option'
  | 'delete-only-on-this-device'
  | 'Delete'
  | 'Disable disappearing messages'
  | 'disappearing-messages-menu-option'
  | 'Disappearing messages type and time'
  | 'Display name'
  | 'donate-menu-item'
  | 'Download'
  | 'Download media'
  | 'edit-profile-icon'
  | 'Empty list'
  | 'Enable'
  | 'enjoy-session-negative-button'
  | 'enjoy-session-positive-button'
  | 'Enter display name'
  | 'error-message'
  | 'Fast mode notifications button'
  | 'group-description'
  | 'Group name'
  | 'Group name input'
  | 'hide-nts-confirm-button'
  | 'hide-nts-menu-option'
  | 'Hide'
  | 'Hide recovery password button'
  | 'Image button'
  | 'Image picker'
  | 'invite-accountid-menu-option'
  | 'invite-contacts-menu-option'
  | 'Invite button'
  | 'Invite friend button'
  | 'Join'
  | 'Join community button'
  | 'Last updated timestamp'
  | 'Learn about staking link'
  | 'Learn more link'
  | 'leave-group-confirm-button'
  | 'leave-group-menu-option'
  | 'Leave'
  | 'Loading animation'
  | 'manage-admins-menu-option'
  | 'manage-members-menu-option'
  | 'Market cap amount'
  | 'MeetingSE option'
  | 'Modal description'
  | 'Modal heading'
  | 'Navigate back'
  | 'network.loki.messenger:id/acceptCallButton'
  | 'network.loki.messenger:id/action_apply'
  | 'network.loki.messenger:id/back_button'
  | 'network.loki.messenger:id/call_text_view'
  | 'network.loki.messenger:id/callInProgress'
  | 'network.loki.messenger:id/callSubtitle'
  | 'network.loki.messenger:id/callTitle'
  | 'network.loki.messenger:id/characterLimitText'
  | 'network.loki.messenger:id/crop_image_menu_crop'
  | 'network.loki.messenger:id/emptyStateContainer'
  | 'network.loki.messenger:id/endCallButton'
  | 'network.loki.messenger:id/layout_emoji_container'
  | 'network.loki.messenger:id/linkPreviewView'
  | 'network.loki.messenger:id/mediapicker_folder_item_thumbnail'
  | 'network.loki.messenger:id/mediapicker_image_item_thumbnail'
  | 'network.loki.messenger:id/messageStatusTextView'
  | 'network.loki.messenger:id/openGroupTitleTextView'
  | 'network.loki.messenger:id/play_overlay'
  | 'network.loki.messenger:id/reaction_1'
  | 'network.loki.messenger:id/reactions_pill_count'
  | 'network.loki.messenger:id/scrollToBottomButton'
  | 'network.loki.messenger:id/search_cancel'
  | 'network.loki.messenger:id/search_result_title'
  | 'network.loki.messenger:id/sendAcceptsTextView'
  | 'network.loki.messenger:id/singleModeImageView'
  | 'network.loki.messenger:id/system_settings_app_icon'
  | 'network.loki.messenger:id/textSendAfterApproval'
  | 'network.loki.messenger:id/theme_option_classic_light'
  | 'network.loki.messenger:id/thumbnail_load_indicator'
  | 'network.loki.messenger:id/title'
  | 'New direct message'
  | 'Next'
  | 'nickname-input'
  | 'not-now-button'
  | 'Notifications'
  | 'Okay'
  | 'open-survey-button'
  | 'Open'
  | 'Open URL'
  | 'preferred-display-name'
  | 'Privacy'
  | 'Privacy policy button'
  | 'pro-badge-text'
  | 'promote-members-menu-option'
  | 'Promote'
  | 'qa-collapsing-footer-action_invite'
  | 'qa-collapsing-footer-action_promote'
  | 'qa-collapsing-footer-action_remove'
  | 'Quit'
  | 'rate-app-button'
  | 'Recovery password container'
  | 'Recovery password menu item'
  | 'Recovery phrase input'
  | 'Remove'
  | 'Remove contact button'
  | 'Restore your session button'
  | 'Reveal recovery phrase button'
  | 'Save'
  | 'Select All'
  | 'Send Invite'
  | 'SESH price'
  | 'session-network-menu-item'
  | 'Session id input box'
  | 'set-nickname-confirm-button'
  | 'Set button'
  | 'Share button'
  | 'show-nts-confirm-button'
  | 'Show'
  | 'Slow mode notifications button'
  | 'Staking reward pool amount'
  | 'Terms of service button'
  | 'update-group-info-confirm-button'
  | 'update-group-info-description-input'
  | 'update-group-info-name-input'
  | 'update-username-confirm-button'
  | 'User settings'
  | 'Version warning banner'
  | 'Yes'
  | `All ${AppName} notifications`
  | `cta-feature-${number}`
  | `Disappear after ${DisappearModes} option`;

export type TestRisk = 'high' | 'low' | 'medium';

export type AppName = 'Session AQA' | 'Session QA';

export type ScreenshotFileNames =
  | 'app_disguise'
  | 'conversation_alice'
  | 'conversation_bob'
  | 'cta_donate'
  | 'landingpage_new_account'
  | 'landingpage_restore_account'
  | 'settings_appearance'
  | 'settings_conversations'
  | 'settings_notifications'
  | 'settings_privacy'
  | 'settings'
  | 'upm_home';
