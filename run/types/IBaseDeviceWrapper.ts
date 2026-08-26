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
   * Set this account's display picture to the suite's ANIMATED image.
   *
   * Platform-neutral on purpose, because which client performs the change is the variable a
   * cross-platform spec varies — but the two sides pick the file very differently, and only the name
   * hides that. Mobile picks it in the app's own picker (pushed to the device, or preloaded into the
   * simulator image); desktop has no picker to drive under test integration and returns whatever
   * `fakeAvatarPickerFile` named at LAUNCH, so a desktop client can only satisfy this if the test
   * opened it with that context.
   *
   * Pro-gated: a non-Pro account gets the upsell CTA instead of an upload, and neither implementation
   * treats that as an error — the same-platform specs assert that case deliberately. A caller that
   * wants the picture SET must therefore make the account Pro first and then assert the picture, not
   * assume this succeeded.
   */
  setAnimatedDisplayPicture(): Promise<void>;
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
   * Open the 1:1 with `convoName` and assert the avatar in its CONVERSATION HEADER renders ANIMATED.
   *
   * Named for the surface, and the surface decides whose picture this is: a 1:1 header always draws
   * the person the conversation is *with*, never the local user — which makes this the stronger of
   * the two assertions. Passing means this client both fetched that person's avatar and verified
   * their Pro proof. The display-level Pro mocks write no config and produce no proof, so only a real
   * grant on the other side satisfies it.
   *
   * The exact negative of `verifyConversationHeaderAvatarNotAnimated` (desktop-only), which reads the
   * same surface and is asserted the opposite way round.
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
   * Receiver-side: the badge belongs to the person the conversation is *with*, so this is never an
   * assertion about this device's own user. Rendering it means this client verified a real proof —
   * the display-level Pro mocks produce none, so only a real grant satisfies it.
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
  sendLongProMessage(convoName: string, message: string): Promise<void>;
}
