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
   * Assert the LOCAL user's own display picture renders here as an ANIMATED image.
   *
   * Own-side. Two things have to be true for it to pass: the picture reached this client (by config
   * sync, when it was set on a different client), and this client believes the account is entitled to
   * animate it — an animated display picture is Pro-gated, and a client that does not hold a valid
   * proof renders the first frame instead of failing loudly.
   *
   * Mobile navigates to settings for this — the settings avatar is the only place it draws the local
   * user's picture large enough to sample — and closes settings behind itself, so a mobile client
   * ends on the home screen whichever screen it started on.
   */
  assertOwnAvatarAnimated(): Promise<void>;
  /**
   * Open the 1:1 with `convoName` and assert THAT PERSON's display picture renders here as ANIMATED.
   *
   * Receiver-side, and the stronger of the two: the picture belongs to the person the conversation is
   * *with*, so passing means this client both fetched their avatar and verified their Pro proof. The
   * display-level Pro mocks write no config and produce no proof, so only a real grant on the sender
   * satisfies this.
   */
  assertSenderAvatarAnimated(convoName: string): Promise<void>;

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
   * Receiver-side: the badge belongs to the person the conversation is *with*, so this is never an
   * assertion about this device's own user. Rendering it means this client verified a real proof —
   * the display-level Pro mocks produce none, so only a real grant satisfies it.
   */
  assertSenderProBadge(senderName: string): Promise<void>;
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
  sendLongProMessage(convoName: string, message: string): Promise<void>;
}
