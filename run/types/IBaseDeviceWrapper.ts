import type { User } from './testing';

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

  // Messaging
  sendMessage(message: string): Promise<number>;
  /** Open the conversation whose left-pane name matches `convoName`. */
  openConversationWith(convoName: string): Promise<void>;
  /** Wait until a message with exactly this text is present in the open conversation. */
  waitForMessage(text: string): Promise<void>;

  // Session Pro
  subscribeToPro(user: User): Promise<void>;
  assertProFeatureUnlocked(user: Pick<User, 'accountID'>): Promise<void>;
  /**
   * Open `convoName` and send a message longer than the standard 2000-char cap,
   * retrying until it is accepted (a non-Pro account is blocked by the "longer
   * messages" upgrade CTA). A successful send proves this device has Pro active.
   * Used to verify Pro has synced to a linked device without forcing an app restart.
   */
  sendLongProMessage(convoName: string, message: string): Promise<void>;
}
