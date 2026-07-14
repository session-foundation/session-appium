import type { CTAType } from './cta';
import type { User } from './testing';

/**
 * High-level, platform-NEUTRAL capabilities that make sense on BOTH mobile
 * (Appium) and desktop (Electron/Playwright) clients.
 *
 * HARD RULE: every member here must use platform-neutral signatures only —
 * primitives, enums and plain data types. No Appium element/locator types
 * (`AppiumNextElementType`, `StrategyExtractionObj`, `LocatorsInterface`) and no
 * Playwright `Locator` types may appear here, so that a future `DesktopWrapper`
 * can implement this interface too. Anything Appium-specific belongs in
 * `IMobileWrapper` instead.
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

  // Messaging
  sendMessage(message: string): Promise<number>;

  // CTA / modal
  checkCTA(type: CTAType): Promise<void>;
  verifyNoCTAShows(): Promise<void>;
  dismissCTA(): Promise<void>;
  checkModalStrings(expectedHeading: string, expectedDescription: string): Promise<void>;

  // Session Pro
  subscribeToPro(user: User): Promise<void>;
  assertProActive(): Promise<void>;
  assertProFeatureUnlocked(user: Pick<User, 'accountID'>): Promise<void>;
}
