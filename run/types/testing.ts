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
  ImagesFolderKeyboardOpen: { x: 36, y: 527 },
  ImagesFolderKeyboardClosed: { x: 36, y: 792 },
  GifButtonKeyboardOpen: { x: 36, y: 420 },
  GifButtonKeyboardClosed: { x: 36, y: 689 },
  DocumentKeyboardOpen: { x: 36, y: 476 },
  DocumentKeyboardClosed: { x: 36, y: 740 },
  NetworkPageAndroid: { x: 880, y: 1150 },
  NetworkPageIOS: { x: 308, y: 220 },
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
  | `(//android.widget.ImageView[@resource-id="network.loki.messenger.qa:id/thumbnail"])[1]`
  | `(//XCUIElementTypeImage[@name="gif cell"])[1]`
  | `//*[./*[@name='${DISAPPEARING_TIMES}']]/*[2]`
  | `//*[@resource-id='network.loki.messenger.qa:id/callTitle' and contains(@text, ':')]`
  | `//*[starts-with(@content-desc, "Photo taken on")]`
  | `//android.widget.TextView[@text="${string}"]`
  | `//XCUIElementTypeAlert//*//XCUIElementTypeButton`
  | `//XCUIElementTypeButton[@name="Continue"]`
  | `//XCUIElementTypeButton[@name="Settings"]`
  | `//XCUIElementTypeCell[@name="${string}"]`
  | `//XCUIElementTypeCell[@name="Session"]`
  | `//XCUIElementTypeImage`
  | `//XCUIElementTypeOther[contains(@name, "Hey,")][1]`
  | `//XCUIElementTypeStaticText[@name="Paste"]`
  | `//XCUIElementTypeStaticText[@name="Videos"]`
  | `//XCUIElementTypeStaticText[contains(@name, '00:')]`
  | `//XCUIElementTypeStaticText[contains(@name, "Version")]`
  | `//XCUIElementTypeSwitch[@name="Read Receipts, Send read receipts in one-to-one chats."]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout[2]/android.widget.Button[1]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ListView/android.widget.LinearLayout`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.view.ViewGroup/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.LinearLayout[5]/android.widget.RelativeLayout/android.widget.TextView[2]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.RelativeLayout/android.widget.ScrollView/androidx.viewpager.widget.ViewPager/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.FrameLayout[1]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/androidx.appcompat.widget.LinearLayoutCompat/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.TextView[2]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.TabHost/android.widget.LinearLayout/android.widget.FrameLayout/androidx.viewpager.widget.ViewPager/android.widget.RelativeLayout/android.widget.GridView/android.widget.LinearLayout/android.widget.LinearLayout[2]`;

export type UiAutomatorQuery =
  | 'new UiScrollable(new UiSelector().className("android.widget.ScrollView")).scrollIntoView(new UiSelector().resourceId("Appearance"))'
  | 'new UiScrollable(new UiSelector().className("android.widget.ScrollView")).scrollIntoView(new UiSelector().resourceId("Conversations"))'
  | 'new UiScrollable(new UiSelector().className("android.widget.ScrollView")).scrollIntoView(new UiSelector().resourceId("path-menu-item"))'
  | 'new UiScrollable(new UiSelector().className("android.widget.ScrollView")).scrollIntoView(new UiSelector().text("Select app icon"))'
  | 'new UiScrollable(new UiSelector().className("android.widget.ScrollView")).scrollIntoView(new UiSelector().textStartsWith("Version"))'
  | 'new UiSelector().text("Enter your display name")'
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
  | 'Block'
  | 'blocked-banner'
  | 'Blocked banner'
  | 'Blocked contacts'
  | 'Blocked Contacts'
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
  | 'Media message'
  | 'MeetingSE'
  | 'Meetings option'
  | 'Mentions list'
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
  | 'Account ID'
  | 'android:id/content_preview_text'
  | 'android:id/summary'
  | 'android:id/text1'
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
  | 'com.google.android.apps.photos:id/text'
  | 'Community input'
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
  | 'delete-contact-confirm-button'
  | 'delete-contact-menu-option'
  | 'delete-conversation-confirm-button'
  | 'delete-conversation-menu-option'
  | 'delete-for-everyone'
  | 'delete-only-on-this-device'
  | 'Delete'
  | 'Disable disappearing messages'
  | 'disappearing-messages-menu-option'
  | 'Disappearing messages type and time'
  | 'donate-menu-item'
  | 'Download media'
  | 'edit-profile-icon'
  | 'Empty list'
  | 'enjoy-session-negative-button'
  | 'enjoy-session-positive-button'
  | 'Enter display name'
  | 'error-message'
  | 'group-description'
  | 'Group name'
  | 'Group name input'
  | 'hide-nts-confirm-button'
  | 'hide-nts-menu-option'
  | 'Hide'
  | 'Hide recovery password button'
  | 'Image button'
  | 'Image picker'
  | 'invite-contacts-button'
  | 'invite-contacts-menu-option'
  | 'Invite button'
  | 'Invite friend button'
  | 'Join community button'
  | 'Last updated timestamp'
  | 'Learn about staking link'
  | 'Learn more link'
  | 'leave-group-confirm-button'
  | 'leave-group-menu-option'
  | 'Leave'
  | 'Loading animation'
  | 'manage-members-menu-option'
  | 'MeetingSE option'
  | 'Modal description'
  | 'Modal heading'
  | 'Navigate back'
  | 'network.loki.messenger.qa:id/acceptCallButton'
  | 'network.loki.messenger.qa:id/action_apply'
  | 'network.loki.messenger.qa:id/back_button'
  | 'network.loki.messenger.qa:id/call_text_view'
  | 'network.loki.messenger.qa:id/callInProgress'
  | 'network.loki.messenger.qa:id/callSubtitle'
  | 'network.loki.messenger.qa:id/callTitle'
  | 'network.loki.messenger.qa:id/crop_image_menu_crop'
  | 'network.loki.messenger.qa:id/emptyStateContainer'
  | 'network.loki.messenger.qa:id/endCallButton'
  | 'network.loki.messenger.qa:id/layout_emoji_container'
  | 'network.loki.messenger.qa:id/linkPreviewView'
  | 'network.loki.messenger.qa:id/mediapicker_folder_item_thumbnail'
  | 'network.loki.messenger.qa:id/mediapicker_image_item_thumbnail'
  | 'network.loki.messenger.qa:id/messageStatusTextView'
  | 'network.loki.messenger.qa:id/openGroupTitleTextView'
  | 'network.loki.messenger.qa:id/play_overlay'
  | 'network.loki.messenger.qa:id/reaction_1'
  | 'network.loki.messenger.qa:id/reactions_pill_count'
  | 'network.loki.messenger.qa:id/scrollToBottomButton'
  | 'network.loki.messenger.qa:id/search_cancel'
  | 'network.loki.messenger.qa:id/search_result_title'
  | 'network.loki.messenger.qa:id/sendAcceptsTextView'
  | 'network.loki.messenger.qa:id/singleModeImageView'
  | 'network.loki.messenger.qa:id/system_settings_app_icon'
  | 'network.loki.messenger.qa:id/textSendAfterApproval'
  | 'network.loki.messenger.qa:id/theme_option_classic_light'
  | 'network.loki.messenger.qa:id/thumbnail_load_indicator'
  | 'network.loki.messenger.qa:id/title'
  | 'New direct message'
  | 'Next'
  | 'nickname-input'
  | 'not-now-button'
  | 'Notifications'
  | 'open-survey-button'
  | 'Open'
  | 'Open URL'
  | 'preferred-display-name'
  | 'Privacy'
  | 'Privacy Policy'
  | 'pro-badge-text'
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
  | 'session-network-menu-item'
  | 'Session id input box'
  | 'set-nickname-confirm-button'
  | 'Set button'
  | 'Share button'
  | 'show-nts-confirm-button'
  | 'Show'
  | 'Slow mode notifications button'
  | 'Terms of Service'
  | 'update-group-info-confirm-button'
  | 'update-group-info-description-input'
  | 'update-group-info-name-input'
  | 'update-username-confirm-button'
  | 'User settings'
  | 'Version warning banner'
  | 'Yes'
  | `All ${AppName} notifications`
  | `Disappear after ${DisappearModes} option`;

export type TestRisk = 'high' | 'low' | 'medium';

export type ElementStates = 'new_account' | 'restore_account';

export type PageName = 'network_page' | 'staking_page';

export type Suffix = 'diff' | 'screenshot';

export type AppName = 'Session AQA' | 'Session QA';
