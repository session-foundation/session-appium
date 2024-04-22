export type User = {
  userName: Username;
  sessionID: string;
  recoveryPhrase: string;
};

export type Username = "Alice" | "Bob" | "Charlie" | "Dracula";

export type GroupName =
  | "Test group"
  | "Mentions test group"
  | "Message checks for groups"
  | "Leave group linked device"
  | "Leave group"
  | "Linked device group"
  | "Testing disappearing messages"
  | "Group to test adding contact"
  | "Disappear after send test";

export type Group = {
  userName: GroupName;
  userOne: User;
  userTwo: User;
  userThree: User;
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

export type Strategy = "accessibility id" | "xpath" | "id" | "class name";

export type ConversationType = "1:1" | "Group" | "Community" | "Note to Self";

export type DMTimeOption = "10 seconds" | "30 seconds" | "12 hours" | "1 day" | "1 week" | "2 weeks";

export type DisappearOpts1o1 = ["1:1", "Disappear after read option" | "Disappear after send option", DMTimeOption];

export type DisappearOptsGroup = ["Group" | "Note to Self", "Disappear after send option", DMTimeOption];

export type MergedOptions = DisappearOpts1o1 | DisappearOptsGroup;

export type StrategyExtractionObj =
  | {
      strategy: Extract<Strategy, "id" | "class name">;
      selector: string;
    }
  | {
      strategy: Extract<Strategy, "accessibility id">;
      selector: AccessibilityId;
    }
  | {
      strategy: Extract<Strategy, "xpath">;
      selector: XPath;
    };

export type ControlMessage =
  | `You set disappearing message time to 5 seconds`
  | `${string} set disappearing message time to 5 seconds`
  | `${string} has set their messages to disappear ${DMTimeOption} after they have been sent.`
  | `${string} has set their messages to disappear ${DMTimeOption} after they have been read.`
  | `You set your messages to disappear ${DMTimeOption} after they have been sent.`
  | `You set your messages to disappear ${DMTimeOption} after they have been read.`
  | `You have set messages to disappear ${DMTimeOption} after they have been sent`
  | "Your message request has been accepted."
  | `${string} called you`
  | `Called ${string}`
  | `You called ${string}`
  | "You created a new group."
  | `${string} has left the group.`
  | `${string} left the group.`
  | `${string} renamed the group to: ${string}`
  | `Title is now '${string}'.`
  | `You renamed the group to ${string}`
  | `${string} joined the group.`
  | `You added ${string} to the group.`;

export type XPath =
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ListView/android.widget.LinearLayout`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.TabHost/android.widget.LinearLayout/android.widget.FrameLayout/androidx.viewpager.widget.ViewPager/android.widget.RelativeLayout/android.widget.GridView/android.widget.LinearLayout/android.widget.LinearLayout[2]`
  | `//*[./*[@name='${DMTimeOption}']]/*[2]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.view.ViewGroup/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.LinearLayout[5]/android.widget.RelativeLayout/android.widget.TextView[2]`
  | `(//XCUIElementTypeImage[@name="gif cell"])[1]`
  | `//XCUIElementTypeStaticText[@name="Videos"]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout[2]/android.widget.Button[1]`
  | `//XCUIElementTypeSwitch[@name="Read Receipts, Send read receipts in one-to-one chats."]`
  | `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.RelativeLayout/android.widget.ScrollView/androidx.viewpager.widget.ViewPager/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.FrameLayout[1]`;

export type AccessibilityId =
  | "Create session ID"
  | "Session ID"
  | "Session ID generated"
  | "Session id input box"
  | "Enter display name"
  | "Continue"
  | "Download media"
  | "Slow mode notifications option"
  | "Continue with settings"
  | "Don’t Allow"
  | "Allow"
  | "Recovery Phrase"
  | "Navigate up"
  | "User settings"
  | "Notifications"
  | "Message requests banner"
  | "Message request"
  | "Accept message request"
  | "Your message request has been accepted."
  | "Block message request"
  | "Clear all"
  | "Clear"
  | "No pending message requests"
  | "New conversation button"
  | "New direct message"
  | "Join Community"
  | "Join community"
  | "Join community button"
  | "Enter Community URL"
  | "Community input"
  | "Join"
  | "Conversations"
  | "Create group"
  | "Group name input"
  | "Contact"
  | "Contact mentions"
  | "Empty state label"
  | "Empty list"
  | "Link a device"
  | "Link Device"
  | "Enter your recovery phrase"
  | "Message Notifications"
  | "Settings"
  | "Call"
  | "Answer call"
  | "AnswerCall"
  | "Allow voice and video calls"
  | "End call button"
  | "Close button"
  | "Enable"
  | "More options"
  | "Disappearing Messages"
  | "Disappearing messages"
  | "Disappear after read option"
  | "Disappear after send option"
  | "10 seconds"
  | "30 seconds"
  | "12 hours"
  | "1 day"
  | "1 week"
  | "2 weeks"
  | "Set button"
  | "Disable disappearing messages"
  | "Disappearing messages time picker"
  | "Time selector"
  | "Message input box"
  | "Message body"
  | "Group name"
  | "Accept name change"
  | "Edit group"
  | "Group name text field"
  | "OK"
  | "Cancel"
  | "Apply changes"
  | "Apply"
  | "Conversation list item"
  | "Add members"
  | "Add Members"
  | "Done"
  | "Control message"
  | "Configuration message"
  | "Mentions list"
  | "Send message button"
  | "Message sent status"
  | "Message sent status: Sent"
  | "Message sent status: Read"
  | "Message sent status: Sending"
  | "Message sent status: Failed to send"
  | "Leave group"
  | "Leave"
  | "Username"
  | "Delete message request"
  | "Confirm delete"
  | "Delete"
  | "Block"
  | "Unblock"
  | "Confirm block"
  | "Blocked contacts"
  | "Blocked Contacts"
  | "Recovery phrase reminder"
  | "Back"
  | "Delete message"
  | "Delete just for me"
  | "Delete for me"
  | "Delete for everyone"
  | "Deleted message"
  | "Blocked banner"
  | "Profile picture"
  | "Photo library"
  | "Photos"
  | "Videos"
  | "Document"
  | "All Photos"
  | "Allow Access to All Photos"
  | "Allow Full Access"
  | "Photo, May 01, 1999, 7:00 AM"
  | "profile_picture.jpg, 27.75 kB, May 2, 1999"
  | "profile_picture.jpg, 27.75 kB, May 1, 1999"
  | "Photo taken on May 2, 1999, 7:00:00 AM"
  | "Photo, 01 May 1998, 7:00 am"
  | "1967-05-05 21:00:00 +0000"
  | "1988-09-08 21:00:00 +0000"
  | "Attachments button"
  | "Documents folder"
  | "Untrusted attachment message"
  | "Download"
  | "Media message"
  | "Reply to message"
  | "New voice message"
  | "Voice message"
  | "GIF button"
  | "Text input box"
  | "Send button"
  | "Recents"
  | "Details"
  | "Edit user nickname"
  | "Nickname"
  | "OK_BUTTON"
  | "Next"
  | "Message user"
  | "Decline message request"
  | "Image picker"
  | "Upload"
  | "Save button"
  | "Yes"
  | "No"
  | "Save"
  | "Scroll button"
  | "Add"
  | "Community invitation"
  | "Link preview"
  | "test_file, pdf"
  | "Show roots"
  | "Conversation header name"
  | "Invite"
  | "Follow setting"
  | "Follow Setting"
  | "Set";
