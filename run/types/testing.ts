import { DeviceWrapper } from './DeviceWrapper';

export type User = {
  userName: USERNAME;
  accountID: string;
  recoveryPhrase: string;
};

export enum USERNAME {
  ALICE = 'Alice',
  BOB = 'Bob',
  CHARLIE = 'Charlie',
  DRACULA = 'Dracula',
}

export type GROUPNAME =
  | 'Test group'
  | 'Mentions test group'
  | 'Message checks for groups'
  | 'Leave group linked device'
  | 'Leave group'
  | 'Linked device group'
  | 'Testing disappearing messages'
  | 'Group to test adding contact'
  | 'Disappear after send test'
  | 'Testing voice'
  | 'Disappear after sent test'
  | 'Restore group';

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
  userA: User | undefined;
  userB: User | undefined;
};

export type Coordinates = {
  x: number;
  y: number;
};

export const InteractionPoints: Record<string, Coordinates> = {
  ImagesFolderKeyboardOpen: { x: 34, y: 498 },
  ImagesFolderKeyboardClosed: { x: 34, y: 763 },
  GifButtonKeyboardOpen: { x: 34, y: 394 },
  GifButtonKeyboardClosed: { x: 34, y: 663 },
  DocumentKeyboardOpen: { x: 34, y: 445 },
};

export type Strategy = 'accessibility id' | 'xpath' | 'id' | 'class name';

export type ConversationType = '1:1' | 'Group' | 'Community' | 'Note to Self';

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
      strategy: Extract<Strategy, 'class name'>;
      selector: string;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'id'>;
      selector: Id;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'accessibility id'>;
      selector: AccessibilityId;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'xpath'>;
      selector: XPath;
      text?: string;
    }
  | {
      strategy: Extract<Strategy, 'DMTimeOption'>;
      selector: DISAPPEARING_TIMES;
    };

export type XPath =
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ListView/android.widget.LinearLayout`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.TabHost/android.widget.LinearLayout/android.widget.FrameLayout/androidx.viewpager.widget.ViewPager/android.widget.RelativeLayout/android.widget.GridView/android.widget.LinearLayout/android.widget.LinearLayout[2]`
  | `//*[./*[@name='${DISAPPEARING_TIMES}']]/*[2]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.view.ViewGroup/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.LinearLayout[5]/android.widget.RelativeLayout/android.widget.TextView[2]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.RelativeLayout/android.widget.ScrollView/androidx.viewpager.widget.ViewPager/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.FrameLayout[1]/android.widget.ImageView`
  | `//XCUIElementTypeStaticText[@name="Videos"]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout[2]/android.widget.Button[1]`
  | `//XCUIElementTypeSwitch[@name="Read Receipts, Send read receipts in one-to-one chats."]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.RelativeLayout/android.widget.ScrollView/androidx.viewpager.widget.ViewPager/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.FrameLayout[1]`
  | `//XCUIElementTypeAlert//*//XCUIElementTypeButton`
  | `(//XCUIElementTypeImage[@name="gif cell"])[1]`
  | `//XCUIElementTypeCell[@name="${string}"]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/androidx.appcompat.widget.LinearLayoutCompat/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.TextView[2]`
  | `//XCUIElementTypeStaticText[@name="Paste"]`
  | `//XCUIElementTypeOther[contains(@name, "Hey,")][1]`
  | `//XCUIElementTypeCell[@name="Session"]`;

export type AccessibilityId =
  | 'Create account button'
  | 'Account ID'
  | 'Session ID generated'
  | 'Session id input box'
  | 'Enter display name'
  | 'Display name'
  | 'Continue'
  | 'Slow mode notifications button'
  | 'Continue with settings'
  | 'Don’t Allow'
  | 'Allow'
  | 'Reveal recovery phrase button'
  | 'Recovery password'
  | 'Navigate up'
  | 'User settings'
  | 'Notifications'
  | 'Message requests banner'
  | 'Message request'
  | 'Accept message request'
  | 'Your message request has been accepted.'
  | 'Block message request'
  | 'Clear all'
  | 'Clear'
  | 'No pending message requests'
  | 'New conversation button'
  | 'New direct message'
  | 'Join Community'
  | 'Join community'
  | 'Join community option'
  | 'Join community button'
  | 'Enter Community URL'
  | 'Community input'
  | 'Join'
  | 'Conversations'
  | 'Create group'
  | 'Group name input'
  | 'Contact'
  | 'Contact mentions'
  | 'Empty state label'
  | 'Empty list'
  | 'Restore your session button'
  | 'Link Device'
  | 'Recovery phrase input'
  | 'Message Notifications'
  | 'Settings'
  | 'Call'
  | 'Answer call'
  | 'Allow voice and video calls'
  | 'End call button'
  | 'Close button'
  | 'Enable'
  | 'More options'
  | 'Disappearing Messages'
  | 'Disappearing messages'
  | 'Disappear after read option'
  | 'Disappear after send option'
  | 'Set button'
  | 'Disable disappearing messages'
  | 'Disappearing messages time picker'
  | 'Time selector'
  | 'Message body'
  | 'Group name'
  | 'Accept name change'
  | 'Edit group'
  | 'Group name text field'
  | 'OK'
  | 'Okay'
  | 'Cancel'
  | 'Apply changes'
  | 'Apply'
  | 'Conversation list item'
  | 'Invite Contacts'
  | 'Add members'
  | 'Done'
  | 'Control message'
  | 'Configuration message'
  | 'Mentions list'
  | 'Send message button'
  | 'Send'
  | 'Message sent status'
  | 'Message sent status: Sent'
  | 'Message sent status: Read'
  | 'Message sent status: Sending'
  | 'Message sent status: Failed to send'
  | 'Leave group'
  | 'Leave'
  | 'Username'
  | 'Delete message request'
  | 'Confirm delete'
  | 'Delete'
  | 'Block'
  | 'Block This User - Switch'
  | 'Unblock'
  | 'Confirm block'
  | 'Blocked contacts'
  | 'Blocked Contacts'
  | 'Recovery phrase reminder'
  | 'Back'
  | 'Delete message'
  | 'Delete just for me'
  | 'Delete for me'
  | 'Delete for everyone'
  | 'Deleted message'
  | 'Blocked banner'
  | 'Photo library'
  | 'Photos'
  | 'Videos'
  | 'Document'
  | 'All Photos'
  | 'Allow Access to All Photos'
  | 'Allow Full Access'
  | 'Photo, May 01, 1999, 7:00 AM'
  | 'profile_picture.jpg, 27.75 kB, May 2, 1999'
  | 'profile_picture.jpg, 27.75 kB, May 1, 1999'
  | 'profile_picture.jpg, 27.75 kB, May 1, 1998'
  | 'Photo taken on May 2, 1999 7:00:00 AM'
  | 'Photo, 01 May 1998, 7:00 am'
  | '1988-09-08 21:00:00 +0000'
  | 'Attachments button'
  | 'Documents folder'
  | 'Images folder'
  | 'Untrusted attachment message'
  | 'Download media'
  | 'Download'
  | 'Media message'
  | 'Reply to message'
  | 'New voice message'
  | 'Voice message'
  | 'GIF button'
  | 'Text input box'
  | 'Message input box'
  | 'Message composition'
  | 'Send button'
  | 'Recents'
  | 'Details'
  | 'Edit user nickname'
  | 'Nickname'
  | 'OK_BUTTON'
  | 'Next'
  | 'Message user'
  | 'Decline message request'
  | 'Image picker'
  | 'Upload'
  | 'Save button'
  | 'Yes'
  | 'No'
  | 'Save'
  | 'Scroll button'
  | 'Add'
  | 'Community invitation'
  | 'Link preview'
  | 'test_file, pdf'
  | 'Show roots'
  | 'Conversation header name'
  | 'Invite'
  | 'Follow setting'
  | 'Set'
  | DISAPPEARING_TIMES
  | 'Off'
  | `${DISAPPEARING_TIMES} - Radio`
  | 'Loading animation'
  | 'Recovery password container'
  | 'Copy button'
  | 'space'
  | 'Recovery password input'
  | 'Read Receipts - Switch'
  | 'Recovery password menu item'
  | 'Hide recovery password button'
  | 'Hide Recovery Password Permanently'
  | 'Invite friend button'
  | 'Share button'
  | 'Copy'
  | 'Modal heading'
  | 'Modal description'
  | 'Disappearing messages type and time'
  | 'Confirm'
  | 'Delete on this device only'
  | 'Search button'
  | 'Search icon'
  | 'Note to Self'
  | 'X'
  | 'Close'
  | 'Continue button'
  | 'Error message'
  | 'Open URL'
  | 'Terms of Service'
  | 'Privacy Policy'
  | 'TabBarItemTitle'
  | 'URL'
  | 'Voice and Video Calls - Switch'
  | 'Hide'
  | 'Session'
  | 'Share'
  | 'Photo taken on Jun 12, 2103 2:28:16 PM'
  | 'Photo, 19 March 2024, 5:13 pm'
  // Possible time string outputs from convertTime function
  | '1967-05-06 07:00:00 +0000'
  | '1967-05-05 20:00:00 +0000'
  | '1967-05-05 21:00:00 +0000'
  | 'Username input'
  | 'Pin';

export type Id =
  | 'Modal heading'
  | 'Modal description'
  | 'Continue'
  | 'Yes'
  | 'android:id/summary'
  | 'com.android.permissioncontroller:id/permission_allow_foreground_only_button'
  | 'com.android.permissioncontroller:id/permission_deny_button'
  | 'Privacy'
  | 'network.loki.messenger:id/scrollToBottomButton'
  | 'android:id/text1'
  | 'android:id/title'
  | 'com.android.permissioncontroller:id/permission_allow_button'
  | 'network.loki.messenger:id/mediapicker_image_item_thumbnail'
  | 'network.loki.messenger:id/mediapicker_folder_item_thumbnail'
  | 'com.android.permissioncontroller:id/permission_allow_all_button'
  | 'network.loki.messenger:id/thumbnail_load_indicator'
  | 'Select All'
  | 'network.loki.messenger:id/crop_image_menu_crop'
  | 'network.loki.messenger:id/endCallButton'
  | 'network.loki.messenger:id/acceptCallButton'
  | `network.loki.messenger:id/title`
  | 'network.loki.messenger:id/messageStatusTextView'
  | 'network.loki.messenger:id/play_overlay'
  | 'network.loki.messenger:id/sendAcceptsTextView'
  | 'network.loki.messenger:id/textSendAfterApproval'
  | 'network.loki.messenger:id/linkPreviewView'
  | 'network.loki.messenger:id/openGroupTitleTextView'
  | 'Image picker'
  | 'network.loki.messenger:id/action_apply'
  | 'Save'
  | 'Delete'
  | 'android:id/content_preview_text'
  | 'network.loki.messenger:id/search_result_title'
  | 'com.android.chrome:id/url_bar'
  | 'Terms of Service'
  | 'Privacy Policy'
  | 'com.android.chrome:id/signin_fre_dismiss_button'
  | 'com.android.chrome:id/negative_button'
  | 'network.loki.messenger:id/back_button'
  | 'Quit'
  | 'network.loki.messenger:id/singleModeImageView'
  | 'network.loki.messenger:id/emptyStateContainer'
  | 'Hide'
  | 'Contact'
  | 'com.google.android.apps.photos:id/text'
  | 'network.loki.messenger:id/search_cancel';

export type TestRisk = 'high' | 'medium' | 'low' | undefined;

export type ElementStates = 'new_account' | 'restore_account';
