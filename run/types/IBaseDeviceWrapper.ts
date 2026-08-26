import type { StateUser } from '@session-foundation/qa-seeder';

import type { ProMessageFeature } from '../test/utils/pro_message_features';

/**
 * High-level, platform-NEUTRAL capabilities that a Session client of ANY
 * platform (mobile Appium or desktop Electron/Playwright) can perform.
 *
 * HARD RULE: every member here must use platform-neutral signatures only —
 * primitives, enums and plain data types. No Appium element/locator types
 * (`AppiumNextElementType`, `StrategyExtractionObj`, `LocatorsInterface`) and no
 * Playwright `Locator` types may appear here. Anything one platform cannot
 * implement today (e.g. the Appium-shaped CTA/modal helpers, or the mobile-only
 * "Pro Activated" settings assertion) belongs in `IMobileWrapper` instead, and
 * is promoted here only once every platform can satisfy it.
 */
export interface IBaseDeviceWrapper {
  // Logging
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;

  // Identity / lifecycle
  setDeviceIdentity(identity: string): void;
  getDeviceIdentity(): string;
  deleteSession(): Promise<void>;

  // Account
  restoreFromSeed(recoveryPhrase: string): Promise<void>;

  // Profile
  changeDisplayName(name: string): Promise<void>;
  assertDisplayName(name: string): Promise<void>;
  /**
   * Set this account's display picture to the suite's animated image.
   *
   * Desktop can only satisfy this if the window was LAUNCHED with `fakeAvatarPickerFile` — it has no
   * picker to drive. Pro-gated, and a non-Pro account silently gets the upsell CTA instead of an
   * upload, so make the account Pro first and assert the picture rather than assuming this worked.
   */
  setAnimatedDisplayPicture(): Promise<void>;
  /**
   * Assert the local user's own display picture renders animated, on the settings page.
   *
   * A client without a valid proof renders the first frame rather than failing, so this is a Pro
   * assertion as much as a sync one. Both platforms open settings and close it behind themselves.
   */
  assertSettingsAvatarAnimated(): Promise<void>;
  /**
   * Open the 1:1 with `convoName` and assert the header avatar renders animated.
   *
   * A 1:1 header always draws the peer, never the local user, so this needs a real grant on the other
   * side — the display-level Pro mocks produce no proof. Negative: `verifyConversationHeaderAvatarNotAnimated`.
   */
  assertConversationHeaderAvatarAnimated(convoName: string): Promise<void>;

  // Messaging
  sendMessage(message: string): Promise<number>;
  /** Open the conversation whose left-pane name matches `convoName`. */
  openConversationWith(convoName: string): Promise<void>;
  /** Wait until a message with exactly this text is present in the open conversation. */
  waitForMessage(text: string): Promise<void>;

  // Session Pro
  subscribeToPro(user: StateUser): Promise<void>;
  /**
   * Open the 1:1 with `senderName` and assert their Session Pro badge renders here.
   *
   * Receiver-side, so it needs a real grant: the display-level Pro mocks produce no proof.
   */
  assertConversationHeaderProBadge(senderName: string): Promise<void>;
  /**
   * Open the 1:1 with `senderName` and assert their Session Pro badge is **not** rendered here.
   *
   * Anchored on `anchorMessage` — a message known to be in this conversation — being on screen at the
   * same instant, deliberately. An absence
   * assertion is satisfied by every way of showing nothing — a conversation that never opened, a
   * profile that never arrived, a header still loading — so unanchored it would pass long before the
   * behaviour under test happened, and keep passing if that behaviour broke.
   *
   * The anchor is a MESSAGE rather than the header name because the name is not stable across the
   * transition under test: on iOS the header is one accessibility element, so a shown badge turns its
   * label from "Alice" into "Alice, Session Pro". Anchoring on the name therefore fails to resolve in
   * exactly the state this assertion exists to catch, and reports it as a navigation fault.
   *
   * Polls rather than reads once: the badge goes away when the client learns of a revocation, which is
   * an asynchronous fetch, so the interesting outcome is "stops rendering within", not "is absent now".
   */
  assertNoConversationHeaderProBadge(senderName: string, anchorMessage?: string): Promise<void>;
  /**
   * Open `message`'s info screen and assert it lists the Pro features the message was sent with.
   *
   * Sharper than any badge: the features travel *in the message* as a bitset, so this names what this
   * particular message carried rather than what the sender's profile currently claims.
   */
  assertMessageProFeatures(message: string, features: ProMessageFeature[]): Promise<void>;
  assertProFeatureUnlocked(user: Pick<StateUser, 'sessionId'>): Promise<void>;
  /**
   * Open `convoName` and send a message longer than the standard 2000-char cap,
   * retrying until it is accepted (a non-Pro account is blocked by the "longer
   * messages" upgrade CTA). A successful send proves this device has Pro active.
   * Used to verify Pro has synced to a linked device without forcing an app restart.
   */
  /**
   * Wait until this client shows its OWN Pro badge on the settings root.
   *
   * Never opens the Pro settings page: that fires `get_pro_status` on mount, so a linked device
   * polling there becomes a second client minting against the same account. The settings-root badge
   * is fetch-free on all three platforms.
   */
  waitForOwnProBadge(maxWaitMs?: number): Promise<void>;
  sendLongProMessage(convoName: string, message: string): Promise<void>;
}
