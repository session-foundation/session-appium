import type { Constraints, DefaultCreateSessionResult } from '@appium/types';
import type { StateUser } from '@session-foundation/qa-seeder';

import { getImageOccurrence } from '@appium/opencv';
import { TestInfo } from '@playwright/test';
import { AndroidUiautomator2Driver } from 'appium-uiautomator2-driver';
import { W3CUiautomator2DriverCaps } from 'appium-uiautomator2-driver/build/lib/types';
import { W3CXCUITestDriverCaps, XCUITestDriver } from 'appium-xcuitest-driver/build/lib/driver';
import fs from 'fs/promises';
import Fuse from 'fuse.js';
import { isArray, isEmpty } from 'lodash';
import { createHash } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import * as sinon from 'sinon';

import type { SupportedPlatformsType } from '../test/utils/open_app';
import type { IMobileWrapper } from './IMobileWrapper';

import {
  ChangeProfilePictureButton,
  ClearInputButton,
  CloseSettings,
  describeLocator,
  DownloadMediaButton,
  EditUsernameButton,
  FirstGif,
  GIFName,
  ImageName,
  ImagePermissionsModalAllow,
  LocatorsInterface,
  ReadReceiptsButton,
  UsernameDisplay,
  UsernameInput,
} from '../../run/test/locators';
import {
  animatedProfilePicture,
  mediaFolder,
  profilePicture,
  testFile,
  testImage,
  testVideo,
  testVideoThumbnail,
} from '../constants/testfiles';
import { tStripped } from '../localizer/lib';
import {
  AVATAR_SYNC_MAX_WAIT_MS,
  GENERATED_AVATAR_COLORS,
  MESSAGE_DELIVERY_TIMEOUT_MS,
} from '../shared/constants';
import { makeAccountPro } from '../shared/pro_grant';
import {
  AcceptMessageRequestButton,
  AttachmentsButton,
  ConversationHeaderName,
  ConversationSettings,
  DocumentsFolderButton,
  GIFButton,
  ImagesFolderButton,
  MessageBody,
  MessageInput,
  MessageReadMore,
  NewVoiceMessageButton,
  OutgoingMessageStatusSent,
  ScrollToBottomButton,
  SendButton,
} from '../test/locators/conversation';
import {
  Contact,
  CTABody,
  CTAButtonNegative,
  CTAButtonPositive,
  CTAFeature,
  CTAHeading,
  ModalDescription,
  ModalHeading,
} from '../test/locators/global';
import {
  ConversationItem,
  MessageRequestItem,
  MessageRequestsBanner,
  PinConversationOption,
  PlusButton,
  UnpinConversationOption,
} from '../test/locators/home';
import { LoadingAnimation } from '../test/locators/onboarding';
import {
  ConversationHeaderProBadge,
  MessageInfoMenuItem,
  ProFeatureRow,
} from '../test/locators/pro';
import {
  PrivacyMenuItem,
  ProAnimatedDisplayPictureModalDescription,
  SaveNameChangeButton,
  SaveProfilePictureButton,
  UserAvatar,
  UserSettings,
  VersionNumber,
} from '../test/locators/settings';
import { EnterAccountID, NewMessageOption, NextButton } from '../test/locators/start_conversation';
import { clickOnCoordinates, sleepFor, verify } from '../test/utils';
import { getAdbFullPath } from '../test/utils/binaries';
import { androidAppPackage } from '../test/utils/capabilities_android';
import { parseDataImage } from '../test/utils/check_colour';
import { isSameColor } from '../test/utils/check_colour';
import { proFeatureTestId, type ProMessageFeature } from '../test/utils/pro_message_features';
import { assertProFromSettingsRow } from '../test/utils/pro_refresh';
import { type ProStatCounts, readProStats } from '../test/utils/pro_settings';
import { restoreAccountNoFallback } from '../test/utils/restore_account';
import {
  isDeviceAndroid,
  isDeviceIOS,
  runScriptAndLog,
  runScriptOrThrow,
} from '../test/utils/utilities';
import { CTAConfig, ctaConfigs, CTADismissal, CTAType } from './cta';
import {
  AccessibilityId,
  Coordinates,
  DISAPPEARING_TIMES,
  Id,
  InteractionPoints,
  Strategy,
  StrategyExtractionObj,
  XPath,
} from './testing';

export type ActionSequence = {
  actions: string;
};

type AppiumNextElementType = { ELEMENT: string };

type PollResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** A rect from the accessibility tree, in points. */
type PickerRect = { height: number; width: number; x: number; y: number };

/**
 * A candidate set in an iOS picker, addressed by element type and optionally by accessibility name.
 *
 * `name` is what makes the photo grid separable from the app behind the sheet: every thumbnail carries
 * `PXGGridLayout-Info`, while the app's own images carry their asset names. Measured on the
 * profile-picture picker, the unfiltered set was 23 elements of which 10 were photos.
 */
type PickerCandidates = { name?: string; type: 'XCUIElementTypeCell' | 'XCUIElementTypeImage' };

/**
 * Pull the candidates' rects straight out of the page source.
 *
 * The tree already carries `x`/`y`/`width`/`height`, so this is a parse rather than an element query.
 * Asking XCUITest for the same elements costs multiples of reading them: on the profile-picture picker,
 * 4969ms for `//XCUIElementTypeImage` against 1352ms for the whole page source.
 *
 * `visible` is not consulted. Every element in that picker reports `visible="false"` — the app is behind
 * a sheet and the grid's own thumbnails are marked the same way — so filtering on it discards the
 * targets. Geometry is the reliable test.
 */
function parsePickerRects(source: string, type: string, name?: string): PickerRect[] {
  const screenWidth = windowWidthFromSource(source);
  const screenHeight = windowHeightFromSource(source);
  const tags = source.match(new RegExp(`<${type}\\b[^>]*>`, 'g')) ?? [];
  const rects: PickerRect[] = [];

  for (const tag of tags) {
    if (name !== undefined && !tag.includes(`name="${name}"`)) {
      continue;
    }
    const num = (attr: string): number | null => {
      const m = tag.match(new RegExp(`\\b${attr}="(-?\\d+)"`));
      return m ? Number(m[1]) : null;
    };
    const x = num('x');
    const y = num('y');
    const width = num('width');
    const height = num('height');
    if (x === null || y === null || width === null || height === null) {
      continue;
    }
    // Off-screen and zero-area candidates cannot be tapped and cannot be cropped out of a screenshot of
    // the screen, so they are dropped before either is attempted.
    if (width <= 0 || height <= 0) {
      continue;
    }
    if (x < 0 || y < 0 || x + width > screenWidth || y + height > screenHeight) {
      continue;
    }
    rects.push({ x, y, width, height });
  }
  return rects;
}

function windowWidthFromSource(source: string): number {
  return applicationDimension(source, 'width');
}

function windowHeightFromSource(source: string): number {
  return applicationDimension(source, 'height');
}

/** The application element frames the screen, so its size is the point-space the rects are expressed in. */
function applicationDimension(source: string, attr: 'height' | 'width'): number {
  const app = source.match(/<XCUIElementTypeApplication\b[^>]*>/)?.[0];
  const value = app?.match(new RegExp(`\\b${attr}="(\\d+)"`))?.[1];
  if (!value) {
    throw new Error(`Could not read the application ${attr} from the page source`);
  }
  return Number(value);
}

/**
 * The largest poster texture the emulator's virtual scene will draw. Above it the scene draws nothing at
 * all and the emulator console still reports `OK`, so an oversized image looks exactly like an injection
 * that never happened.
 */
const SCENE_POSTER_MAX_PX = 500;

export class DeviceWrapper implements IMobileWrapper {
  private readonly device: AndroidUiautomator2Driver | XCUITestDriver;
  public readonly udid: string;
  private deviceIdentity: string = '';
  private testInfo: TestInfo;

  constructor(
    device: AndroidUiautomator2Driver | XCUITestDriver,
    udid: string,
    testInfo: TestInfo
  ) {
    this.device = device;
    this.udid = udid;
    this.testInfo = testInfo;
    // Set temporary identity immediately
    this.deviceIdentity = `device-${udid.slice(-4)}`;
  }

  // LOGGING METHODS
  public log(...args: unknown[]): void {
    console.log(`[${this.deviceIdentity}]`, ...args);
  }

  public info(...args: unknown[]): void {
    console.info(`[${this.deviceIdentity}]`, ...args);
  }

  public warn(...args: unknown[]): void {
    console.warn(`[${this.deviceIdentity}]`, ...args);
  }

  public error(...args: unknown[]): void {
    console.error(`[${this.deviceIdentity}]`, ...args);
  }

  // DEVICE IDENTITY METHODS
  public setDeviceIdentity(identity: string): void {
    const oldIdentity = this.deviceIdentity;
    this.deviceIdentity = identity;
    this.log(`Device identity changed from ${oldIdentity} to ${identity}`);
  }

  // Get device identity for labels and logging
  public getDeviceIdentity(): string {
    return this.deviceIdentity;
  }

  public onIOS() {
    if (this.isIOS()) {
      return this;
    }
    return sinon.createStubInstance(DeviceWrapper) as DeviceWrapper;
  }

  public onAndroid() {
    if (this.isAndroid()) {
      return this;
    }
    return sinon.createStubInstance(DeviceWrapper) as DeviceWrapper;
  }

  /**  === all the shared actions ===  */
  public async click(element: string) {
    // this one works for both devices so just call it without casting it
    return this.toShared().click(element);
  }

  public async back(): Promise<void> {
    return this.toShared().back();
  }

  public async clear(elementId: string): Promise<void> {
    return this.toShared().clear(elementId);
  }

  public async getText(elementId: string): Promise<string> {
    return this.toShared().getText(elementId);
  }

  public async setValueImmediate(text: string, elementId: string): Promise<void> {
    return this.toShared().setValueImmediate(text, elementId);
  }

  public async keys(value: string[]): Promise<void> {
    return this.toShared().keys(value);
  }

  public async getElementRect(
    elementId: string
  ): Promise<{ height: number; width: number; x: number; y: number } | undefined> {
    return this.toShared().getElementRect(elementId);
  }

  public async scroll(start: Coordinates, end: Coordinates, duration: number): Promise<void> {
    const actions = [
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: start.x, y: start.y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 500 },
          {
            type: 'pointerMove',
            duration,
            origin: 'pointer',
            x: end.x - start.x,
            y: end.y - start.y,
          },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ];

    await this.toShared().performActions(actions);
  }

  public async pressCoordinates(
    xCoOrdinates: number,
    yCoOrdinates: number,
    longPress?: boolean
  ): Promise<void> {
    const duration = longPress ? 1000 : 200;
    const actions = [
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          {
            type: 'pointerMove',
            duration: 0,
            x: xCoOrdinates,
            y: yCoOrdinates,
          },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration },

          { type: 'pointerUp', button: 0 },
        ],
      },
    ];

    await this.toShared().performActions(actions);
  }

  public async pressHome(): Promise<void> {
    if (this.isIOS()) {
      await this.toIOS().mobilePressButton('home');
      return;
    }
    if (this.isAndroid()) {
      await runScriptAndLog(
        `${getAdbFullPath()} -s ${this.getUdid()} shell input keyevent 3`,
        true
      );
      return;
    }
  }

  public async getElementScreenshot(elementId: string): Promise<string> {
    return this.toShared().getElementScreenshot(elementId);
  }

  public async getScreenshot(): Promise<string> {
    return this.toShared().getScreenshot();
  }

  public async getWindowRect(): Promise<{ height: number; width: number; x: number; y: number }> {
    return this.toShared().getWindowRect();
  }

  // Session management
  public async createSession(
    caps: W3CUiautomator2DriverCaps | W3CXCUITestDriverCaps
  ): Promise<DefaultCreateSessionResult<Constraints>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Driver's createSession is typed as Promise<any>, but actually returns the correct tuple
    return this.toShared().createSession(caps);
  }

  public async deleteSession(): Promise<void> {
    return this.toShared().deleteSession();
  }

  public async getPageSource(): Promise<string> {
    return this.toShared().getPageSource();
  }

  /**
   * Injects a base64-encoded image into the Android emulator's virtual camera scene.
   */
  /**
   * Show an image on the emulator's virtual-scene poster, which is what its camera then sees.
   *
   * The image is resized to {@link SCENE_POSTER_MAX_PX} and forced to RGBA first, because the scene
   * silently refuses anything else and the emulator console reports `OK` either way. Measured against
   * the poster directly: a 954x954 RGBA texture is not drawn at all — the camera shows the room behind
   * it, which reads as "the injection never happened" — while the same image at 500x500 renders. An
   * image without an alpha channel is drawn as solid black.
   */
  public async injectImageToScene(base64Image: string): Promise<void> {
    if (this.isAndroid()) {
      const payload = (
        await sharp(Buffer.from(base64Image, 'base64'))
          .resize(SCENE_POSTER_MAX_PX, SCENE_POSTER_MAX_PX, { fit: 'contain', background: 'white' })
          .flatten({ background: 'white' })
          .ensureAlpha()
          .png()
          .toBuffer()
      ).toString('base64');
      // Driven through the emulator console rather than `mobile: injectEmulatorCameraImage`. The driver
      // command reports success and leaves the poster undrawn, while the same bytes sent by this route
      // render — verified against the poster directly on more than one emulator.
      // Named by content, not by device. The emulator caches the poster texture against the file path,
      // so reusing one path silently keeps the first image every later run is compared against — a scan
      // then decodes a PREVIOUS run's code and the failure names the wrong account rather than the cache.
      const posterHash = createHash('sha1').update(payload).digest('hex').slice(0, 16);
      const posterPath = path.join(os.tmpdir(), `scene-poster-${posterHash}.png`);
      await fs.writeFile(posterPath, Buffer.from(payload, 'base64'));

      await runScriptAndLog(
        `${getAdbFullPath()} -s ${this.getUdid()} emu virtualscene-image table ${posterPath}`,
        true
      );
      this.log(`Injected image to scene`);
    }
    // iOS: no-op
  }

  /**
   * Keep the scene showing `base64Image` until `hasLanded` reports the app has acted on it.
   *
   * Two things make a single send unreliable, and both are invisible from here: a poster handed to a
   * scene whose camera has just started is drawn as a solid black panel, and the previous run's poster
   * survives in a still-running emulator, so a scanner can decode a stale code before a new one arrives.
   * Re-sending until the caller's own condition holds covers both without guessing at a delay, and stops
   * immediately once it does.
   */
  public async injectImageToSceneUntil(
    base64Image: string,
    hasLanded: () => Promise<boolean>,
    attempts: number = 8
  ): Promise<void> {
    for (let attempt = 0; attempt < attempts; attempt++) {
      await this.injectImageToScene(base64Image);
      if (await hasLanded()) {
        return;
      }
    }
    this.info(`The scene still has not shown the injected image after ${attempts} attempts`);
  }

  /* === all the device-specific function ===  */

  // ELEMENT INTERACTION

  // Heal a broken locator by finding potential fuzzy matches with text
  private async findBestMatch(
    strategy: Strategy,
    selector: string,
    text?: string
  ): Promise<{ strategy: Strategy; selector: string } | null> {
    const pageSource = await this.getPageSource();
    const threshold = 0.3; // 0.0 = exact, 1.0 = match anything

    // Identify common element patterns and map them to our strategies
    const candidateStrategies = [
      { strategy: 'accessibility id' as Strategy, pattern: /name="([^"]+)"/g },
      { strategy: 'accessibility id' as Strategy, pattern: /label="([^"]+)"/g },
      { strategy: 'accessibility id' as Strategy, pattern: /identifier="([^"]+)"/g },
      { strategy: 'accessibility id' as Strategy, pattern: /value="([^"]+)"/g },
      { strategy: 'accessibility id' as Strategy, pattern: /content-desc="([^"]+)"/g },
      { strategy: 'id' as Strategy, pattern: /resource-id="([^"]+)"/g },
    ];

    // If this list gets out of hand, consider lowering the threshold
    const blacklist = [
      { from: 'Voice message', to: 'New voice message' },
      { from: 'Message sent status: Sent', to: 'Message sent status: Sending' },
      { from: 'Done', to: 'Donate' },
      { from: 'New conversation button', to: 'conversation-options-avatar' },
      { from: 'Leave group', to: 'Delete group' },
    ];

    // System locators such as 'network.loki.messenger:id' can cause false positives with too high similarity scores
    // Strip any known prefix patterns first
    const stripPrefix = (selector: string) => {
      return selector
        .replace(/^[a-z]+\.[a-z]+\.[a-z]+(\.[a-z]+)?:id\//, '') // package:id/
        .replace(/^com\.android\.[^:]+:id\//, '') // Android system
        .replace(/^android:id\//, ''); // Android framework
    };

    // Extract ALL identifiers from the page
    const allElements: Array<{ strategy: Strategy; selector: string }> = [];
    for (const { strategy, pattern } of candidateStrategies) {
      const matches = [...pageSource.matchAll(pattern)];
      matches.forEach(m => {
        allElements.push({
          strategy,
          selector: m[1],
        });
      });
    }

    // Map elements but keep the original
    const searchableElements = allElements.map(el => ({
      ...el,
      originalSelector: el.selector,
      strippedSelector: stripPrefix(el.selector), // Stripped version for searching
    }));

    // Fuzzy match potential candidates
    const fuse = new Fuse(searchableElements, {
      keys: ['strippedSelector'],
      threshold,
      includeScore: true,
    });

    const results = fuse.search(stripPrefix(selector));

    // Evaluate each candidate with BOTH selector similarity AND text content
    for (const result of results) {
      if (result.score === undefined || result.score >= threshold) continue;

      const match = result.item;
      const selectorConfidence = ((1 - result.score) * 100).toFixed(2);

      const isBlacklisted = blacklist.some(
        pair =>
          (selector.includes(pair.from) && match.originalSelector.includes(pair.to)) ||
          (selector.includes(pair.to) && match.originalSelector.includes(pair.from))
      );

      // Don't heal blacklisted pairs
      if (isBlacklisted) {
        this.log(
          `Skipping healing: prevented "${selector}" from healing to "${match.originalSelector}"`
        );
        continue;
      }

      // Sometimes the element is just not on screen yet - proceed.
      if (match.strategy === strategy && match.originalSelector === selector) {
        continue;
      }

      // Validate the candidate element
      let isValidCandidate: boolean;

      // Always check visibility first
      try {
        const healedElements = await (this.toShared().findElements(
          match.strategy,
          match.originalSelector
        ) as Promise<Array<AppiumNextElementType>>);

        if (!healedElements || healedElements.length === 0) {
          isValidCandidate = false;
        } else {
          // Check if ANY element is visible and (if text provided) contains the text
          isValidCandidate = false; // Assume invalid until proven otherwise

          for (const element of healedElements) {
            try {
              // Check visibility first
              const isVisible = await this.isVisible(element.ELEMENT);
              if (!isVisible) {
                continue; // Skip invisible elements
              }

              // If text is required, check it
              if (text) {
                const elementText = await this.getTextFromElement(element);
                if (!elementText.includes(text)) {
                  continue; // Text doesn't match
                }
              }

              // Passed all checks
              isValidCandidate = true;
              break;
            } catch (e) {
              continue; // Skip elements that error
            }
          }
        }
      } catch (e) {
        isValidCandidate = false;
      }

      // Only accept valid candidates
      if (isValidCandidate) {
        // Check if we've already logged this exact healing
        // Only log new healing signatures
        const healingSignature = `${strategy} "${selector}" ➡ ${match.strategy} "${match.originalSelector}"`;
        const alreadyLogged = this.testInfo.annotations.some(
          a => a.type === 'healed' && a.description?.includes(healingSignature)
        );

        if (!alreadyLogged) {
          this.log(
            `Original locator ${strategy} "${selector}" not found. Test healed with ${match.strategy} "${match.originalSelector}" (${selectorConfidence}% match)`
          );
          this.testInfo.annotations.push({
            type: 'healed',
            description: ` ${healingSignature} (${selectorConfidence}% match)`,
          });
        }

        return {
          strategy: match.strategy,
          selector: match.originalSelector,
        };
      } else if (text) {
        this.log(
          `Candidate ${match.strategy} "${match.originalSelector}" (${selectorConfidence}% match) rejected: missing text "${text}"`
        );
      } else {
        this.log(
          `Candidate ${match.strategy} "${match.originalSelector}" (${selectorConfidence}% match) rejected: not visible`
        );
      }
    }

    return null;
  }

  /**
   * Finds element with self-healing for id/accessibility id strategies.
   * @param skipHealing - Disable self-healing for this call
   * @throws If element not found even after healing attempt.
   */
  public async findElement(
    strategy: Strategy,
    selector: string,
    skipHealing = false
  ): Promise<AppiumNextElementType> {
    try {
      return await (this.toShared().findElement(
        strategy,
        selector
      ) as Promise<AppiumNextElementType>);
    } catch (originalError) {
      // Only try healing for id/accessibility id selectors
      // In the future we can think about extracting values from XPATH etc.
      if (skipHealing || (strategy !== 'accessibility id' && strategy !== 'id')) {
        throw originalError;
      }

      const healed = await this.findBestMatch(strategy, selector);

      if (healed) {
        return await (this.toShared().findElement(
          healed.strategy,
          healed.selector
        ) as Promise<AppiumNextElementType>);
      }

      throw originalError;
    }
  }

  /**
   * Finds elements with self-healing for id/accessibility id strategies.
   * @param skipHealing - Disable self-healing for this call
   * @param expectedText - If provided, validates that at least one healed element contains this text
   * Returns empty array if not found.
   */
  public async findElements(
    strategy: Strategy,
    selector: string,
    skipHealing = false,
    expectedText?: string
  ): Promise<Array<AppiumNextElementType>> {
    const elements = await (this.toShared().findElements(strategy, selector) as Promise<
      Array<AppiumNextElementType>
    >);
    if (elements && elements.length > 0) {
      return elements;
    }

    // Only try healing for id/accessibility id selectors
    if (skipHealing || (strategy !== 'accessibility id' && strategy !== 'id')) {
      return [];
    }

    const healed = await this.findBestMatch(strategy, selector, expectedText);

    if (healed) {
      return (
        (await (this.toShared().findElements(healed.strategy, healed.selector) as Promise<
          Array<AppiumNextElementType>
        >)) || []
      );
    }

    return [];
  }

  private resolveLocator(args: LocatorsInterface | (StrategyExtractionObj & { text?: string })): {
    locator: StrategyExtractionObj;
    description: string;
  } {
    const built = args instanceof LocatorsInterface ? args.build() : args;
    const text = args instanceof LocatorsInterface ? undefined : args.text;
    const locator = text ? { ...built, text } : built;
    return { locator, description: describeLocator(locator) };
  }

  /**
   * Attempts to find an element using a primary locator, and if not found, falls back to a secondary locator.
   * This is useful for supporting UI transitions (e.g., between legacy and Compose Android screens) where
   * the same UI element may have different locators depending on context.
   *
   * @param primaryLocator - The first locator to try (e.g., new Compose locator).
   * @param fallbackLocator - The locator to try if the primary is not found (e.g., legacy locator).
   * @param maxWait - Maximum wait time in milliseconds for each locator (default: 3000).
   * @returns The found element, which can be used for clicking, text extraction, or other operations.
   * @throws If neither locator finds an element within the timeout period.
   *
   */
  public async findWithFallback(
    primaryLocator: LocatorsInterface | StrategyExtractionObj,
    fallbackLocator: LocatorsInterface | StrategyExtractionObj,
    maxWait: number = 3000
  ): Promise<AppiumNextElementType> {
    const { locator: primary, description: primaryDescription } =
      this.resolveLocator(primaryLocator);
    const { locator: fallback, description: fallbackDescription } =
      this.resolveLocator(fallbackLocator);

    try {
      return await this.waitForTextElementToBePresent({ ...primary, maxWait, skipHealing: true });
    } catch (primaryError) {
      console.warn(
        `[findWithFallback] Could not find element with ${primaryDescription}, falling back to ${fallbackDescription}`
      );

      try {
        return await this.waitForTextElementToBePresent({
          ...fallback,
          maxWait,
          skipHealing: true,
        });
      } catch (fallbackError) {
        throw new Error(`Element ${primaryDescription} and ${fallbackDescription} not found.`, {
          cause: fallbackError,
        });
      }
    }
  }

  // Appium taps elements in their center but sometimes that is not desirable
  // The native methods apply the tap offset from the top left corner
  // For a more intuitive offset calculation, this method allows us to
  // define offsets based on the element center
  private async calculateGestureOffset(
    element: AppiumNextElementType,
    offset: Coordinates
  ): Promise<Coordinates> {
    const rect = await this.getElementRect(element.ELEMENT);
    if (!rect) {
      throw new Error('Failed to resolve element rect for offset calculation');
    }
    const { width, height } = rect;
    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);
    // Clamp offset to element bounds
    const x = Math.min(Math.max(centerX + offset.x, 0), rect.width);
    const y = Math.min(Math.max(centerY + offset.y, 0), rect.height);
    return { x, y };
  }

  /**
   * @param offset Pixel offset from the element center.
   *  If an offset is necessary, both x and y must be defined, otherwise Appium doesn't apply the offset parameter.
   */
  public async longClick(element: AppiumNextElementType, durationMs: number, offset?: Coordinates) {
    let xOffset: number | undefined;
    let yOffset: number | undefined;

    if (offset) {
      const offsetCoordinates = await this.calculateGestureOffset(element, offset);
      xOffset = offsetCoordinates.x;
      yOffset = offsetCoordinates.y;
    }

    if (this.isIOS()) {
      // iOS takes a number in seconds
      const duration = Math.floor(durationMs / 1000);
      return this.toIOS().mobileTouchAndHold(duration, xOffset, yOffset, element.ELEMENT);
    }
    return this.toAndroid().mobileLongClickGesture(element.ELEMENT, xOffset, yOffset, durationMs);
  }

  public async clickOnByAccessibilityID(
    accessibilityId: AccessibilityId,
    maxWait?: number
  ): Promise<void> {
    const el = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: accessibilityId,
      maxWait,
    });

    await sleepFor(100);

    if (!el) {
      throw new Error(`Click: Couldnt find accessibilityId: ${accessibilityId}`);
    }
    try {
      await this.click(el.ELEMENT);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'StaleElementReferenceError') {
        this.log('Element is stale, refinding element and attempting second click');
        await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: accessibilityId,
          maxWait: 500,
        });
        await this.click(el.ELEMENT);
      }
    }
  }

  public async clickOnElementAll(
    args: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj)
  ) {
    const locator = args instanceof LocatorsInterface ? args.build() : args;
    const el = await this.waitForTextElementToBePresent({ ...locator });
    await this.click(el.ELEMENT);
    return el;
  }

  /**
   * Clicks an element and retries until an expected element appears, confirming the click registered.
   * Useful for flaky taps where Appium reports success but the UI doesn't respond.
   *
   * @param args - The element to click
   * @param waitFor - A locator that should become present after a successful click
   */
  public async clickAndWaitFor(
    args: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj),
    waitFor: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj)
  ) {
    const { description: firstLocator } = this.resolveLocator(args);
    const { locator: waitForLocator } = this.resolveLocator(waitFor);

    return this.pollUntil(
      async () => {
        const el = await this.waitForTextElementToBePresent(args);
        await this.click(el.ELEMENT);
        try {
          await this.waitForTextElementToBePresent({ ...waitForLocator, maxWait: 1_000 });
          return { success: true, data: el };
        } catch {
          this.log(`Click on ${firstLocator} did not produce expected result, retrying...`);
          return {
            success: false,
            error: `Click on ${firstLocator} did not produce expected result`,
          };
        }
      },
      { maxWait: 5_000, pollInterval: 500 }
    );
  }

  public async clickOnElementByText(
    args: { text: string; maxWait?: number } & StrategyExtractionObj
  ) {
    const { text } = args;
    const el = await this.waitForTextElementToBePresent(args);

    if (!el) {
      throw new Error(`clickOnElementByText: Couldnt find text: ${text}`);
    }
    await this.click(el.ELEMENT);
  }

  public async clickOnElementById(id: Id) {
    await this.waitForTextElementToBePresent({ strategy: 'id', selector: id });
    const el = await this.findElement('id', id);
    await this.click(el.ELEMENT);
  }

  public async clickOnCoordinates(xCoOrdinates: number, yCoOrdinates: number) {
    await this.pressCoordinates(xCoOrdinates, yCoOrdinates);
    this.log(`Tapped coordinates ${xCoOrdinates}, ${yCoOrdinates}`);
  }

  public async longPress(
    args: { text?: string; duration?: number } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<void> {
    const { text, duration = 2000 } = args;
    const locator = args instanceof LocatorsInterface ? args.build() : args;
    // Merge text if provided
    const finalLocator = text ? { ...locator, text } : locator;

    const el = await this.waitForTextElementToBePresent({ ...finalLocator });

    await this.longClick(el, duration);
  }

  /**
   * Long presses a message and waits for the context menu to appear.
   * Retries until successful or timeout is reached.
   *
   * @throws if message not found or context menu fails to appear within maxWait
   */
  public async longPressMessage(
    args: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj),
    options?: { offset?: Coordinates }
  ): Promise<void> {
    const { maxWait = 10_000 } = args;
    const { locator, description } = this.resolveLocator(args);

    this.log(`Attempting long press on ${description}`);

    await this.pollUntil(
      async () => {
        // Find the message
        this.log(`Looking for: ${JSON.stringify(locator)}`);
        const el = await this.waitForTextElementToBePresent({
          ...locator,
          maxWait: 1_000,
        });

        if (!el) {
          return { success: false, error: `Message not found: ${description}` };
        }
        if (options?.offset) {
          this.log(`Offsetting long press by x=${options?.offset?.x}, y=${options?.offset?.y}`);
        }
        // Attempt long click
        await this.longClick(el, 2000, options?.offset);

        // Check if context menu appeared
        const longPressSuccess = await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Reply to message',
          maxWait: 1000,
        });

        if (longPressSuccess) {
          this.log('Long press successful, context menu opened');
          return { success: true, data: el };
        }

        return {
          success: false,
          error: `Long press didn't show context menu for ${description}`,
        };
      },
      {
        maxWait,
        pollInterval: 1000,
        onAttempt: attempt => this.log(`Long press attempt ${attempt}...`),
      }
    );
  }

  public async longPressConversation(userName: string) {
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      try {
        const el = await this.waitForTextElementToBePresent(new ConversationItem(this, userName));

        if (!el) {
          throw new Error(
            `longPress on conversation list: ${userName} unsuccessful, couldn't find conversation`
          );
        }

        await this.longClick(el, 3000);
        // No fixed settle — findWithFallback polls for the menu and returns as soon as it appears
        // (widened to 2000 to preserve the previous total budget while catching it sooner).
        // Either Pin or Unpin will be present depending on whether the conversation is already pinned
        const longPressSuccess = await this.findWithFallback(
          new PinConversationOption(this),
          new UnpinConversationOption(this),
          2000
        );

        if (longPressSuccess) {
          this.log('LongClick successful');
          success = true; // Exit the loop if successful
        } else {
          throw new Error(`longPress on conversation list: ${userName} unsuccessful`);
        }
      } catch (error) {
        this.log(`Longpress attempt ${attempt} failed. Retrying...`);
        attempt++;
        await sleepFor(1000);
        if (attempt >= maxRetries) {
          if (error instanceof Error) {
            error.message = `Longpress on conversation: ${userName} unsuccessful after ${maxRetries} attempts, ${error.toString()}`;
          }
          throw error;
        }
      }
    }
  }

  public async pinConversation(name: string) {
    await this.onIOS().swipeLeft('Conversation list item', name);
    await this.onAndroid().longPressConversation(name);
    await this.clickOnElementAll(new PinConversationOption(this));
    await this.waitForConversationListInteractive();
  }

  public async unpinConversation(name: string) {
    await this.onIOS().swipeLeft('Conversation list item', name);
    await this.onAndroid().longPressConversation(name);
    await this.clickOnElementAll(new UnpinConversationOption(this));
    await this.waitForConversationListInteractive();
  }

  /**
   * Wait until the conversation list can be interacted with again.
   *
   * Clicking a swipe action or context-menu item returns before that menu has closed, so whatever touches
   * the list next — the following pin, a swipe, a tap on a row — can land on the closing overlay and
   * either hit the wrong element or be swallowed. The plus button is unrelated to pinning; it is used
   * because it is only reachable once nothing is covering the list.
   */
  private async waitForConversationListInteractive(): Promise<void> {
    /**
     * A refused pin raises a CTA instead of returning to the list, so the plus button is legitimately
     * unreachable and waiting for it would block until the timeout — naming the plus button, several
     * steps from the refusal that caused it. A CTA up is therefore a settled state too: the caller is
     * about to assert it.
     */
    const ctaShowing = await this.doesElementExist({
      ...new CTAHeading(this).build(),
      maxWait: 2_000,
    });
    if (ctaShowing) {
      return;
    }

    await this.waitForTextElementToBePresent(new PlusButton(this));
  }

  public async pressAndHold(accessibilityId: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: accessibilityId,
    });
    await this.longClick(el, 2000);
  }

  public async getTextFromElement(element: AppiumNextElementType): Promise<string> {
    const text = await this.getText(element.ELEMENT);

    return text;
  }

  public async deleteText(
    args: LocatorsInterface | ({ text?: string; maxWait?: number } & StrategyExtractionObj)
  ) {
    const locator = args instanceof LocatorsInterface ? args.build() : args;
    const el = await this.waitForTextElementToBePresent({ ...locator });
    await this.click(el.ELEMENT);
    await sleepFor(100);
    const maxRetries = 3;
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      await this.longClick(el, 2000);
      if (this.isIOS()) {
        try {
          await this.clickOnElementByText({
            strategy: 'id',
            selector: 'Select All',
            text: 'Select All',
            maxWait: 1000,
          });
          success = true;
        } catch (error: any) {
          this.info(`Retrying long press and select all, attempt ${retries + 1}`);
        }
      } else {
        await this.longClick(el, 2000);
        success = true;
      }
      retries++;
    }
    if (!success) {
      throw new Error(`Failed to find "Select All" button after ${maxRetries} attempts`);
    }

    await this.clear(el.ELEMENT);

    this.info(`Text has been cleared `);
    return;
  }

  // ELEMENT LOCATORS

  public async findElementByAccessibilityId(
    accessibilityId: AccessibilityId
  ): Promise<AppiumNextElementType> {
    const element = await this.findElement('accessibility id', accessibilityId);
    if (!element || isArray(element)) {
      throw new Error(
        `findElementByAccessibilityId: Did not find accessibilityId: ${accessibilityId} or it was an array `
      );
    }
    return element;
  }

  public async findElementsByAccessibilityId(
    accessibilityId: AccessibilityId
  ): Promise<Array<AppiumNextElementType>> {
    const elements = await this.findElements('accessibility id', accessibilityId);
    if (!elements || !isArray(elements) || isEmpty(elements)) {
      throw new Error(
        `findElementsByAccessibilityId: Did not find accessibilityId: ${accessibilityId} `
      );
    }

    return elements;
  }

  public async findElementByXPath(xpath: XPath) {
    const element = await this.findElement('xpath', xpath);
    if (!element) {
      throw new Error(`findElementByXpath: Did not find xpath: ${xpath}`);
    }

    return element;
  }

  public async findTextElementArrayById(
    id: Id,
    textToLookFor: string
  ): Promise<AppiumNextElementType> {
    const elementArray = await this.findElements('id', id);
    const selector = await this.findMatchingTextInElementArray(elementArray, textToLookFor);
    if (!selector) {
      throw new Error(`No matching selector found with text: ${textToLookFor}`);
    }

    return selector;
  }

  public async findMatchingTextAndAccessibilityId(
    accessibilityId: AccessibilityId,
    textToLookFor: string
  ): Promise<AppiumNextElementType> {
    const elements = await this.findElementsByAccessibilityId(accessibilityId);

    const foundElementMatchingText = await this.findMatchingTextInElementArray(
      elements,
      textToLookFor
    );
    if (!foundElementMatchingText) {
      throw new Error(
        `Did not find element with accessibilityId ${accessibilityId} and text body: ${textToLookFor}`
      );
    }

    return foundElementMatchingText;
  }

  /**
   * Finds the element in `elements` whose accessibility **label** matches, rather than its value.
   *
   * Separate from [findMatchingTextInElementArray] because the two read different attributes and the
   * distinction is load-bearing on iOS: an accessibility identifier becomes the element's `name` and
   * displaces the display text into `label`, so a `text` match silently stops working the moment an
   * element gains an id. Matching the label directly is what lets a locator say "this identifier AND
   * this message" without dropping to xpath.
   */
  public async findMatchingLabelInElementArray(
    elements: Array<AppiumNextElementType>,
    labelToLookFor: string
  ): Promise<AppiumNextElementType | null> {
    if (!elements?.length) {
      return null;
    }

    const normalize = (value: string) =>
      value
        // Strip LTR/RTL markers and other whitespace nonsense, matching the text comparison.
        .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
        // Collapse runs of whitespace, so a line break in the rendered copy compares equal to the
        // space the localizer produces. The same token reaches here in three shapes \u2014 a break on
        // iOS, `\n` from Android's strings.xml, and a space from `tStripped` \u2014 and the difference is
        // presentation, not copy. Collapsing, not stripping: removing whitespace entirely would let
        // genuinely different strings collide.
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const matching = await this.findAsync(elements, async element => {
      const value = await this.getAttribute('label', element.ELEMENT).catch(() => null);
      return Boolean(value && normalize(value) === normalize(labelToLookFor));
    });

    if (!matching) {
      // A label mismatch otherwise reports only that the element was not found, which reads as a wrong
      // locator rather than as copy that differs by a character. Both sides are logged normalised, so
      // what is compared is what is shown.
      const seen = await Promise.all(
        elements.map(element => this.getAttribute('label', element.ELEMENT).catch(() => null))
      );
      this.log(
        `No label matched. Wanted: "${normalize(labelToLookFor)}". Saw: ` +
          seen
            .filter((value): value is string => Boolean(value))
            .map(value => `"${normalize(value)}"`)
            .join(', ')
      );
    }

    return matching || null;
  }

  public async findMatchingTextInElementArray(
    elements: Array<AppiumNextElementType>,
    textToLookFor: string
  ): Promise<AppiumNextElementType | null> {
    if (elements && elements.length) {
      const matching = await this.findAsync(elements, async e => {
        const text = await this.getTextFromElement(e);
        // Strip LTR/RTL markers and other whitespace nonsense, and collapse whitespace runs for the
        // same reason as the label comparison: the rendered line break and the localizer's space are
        // the same copy.
        const normalize = (s: string) =>
          s
            .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const isExactMatch = text && normalize(text) === normalize(textToLookFor);
        return Boolean(isExactMatch);
      });

      return matching || null;
    }
    if (!elements) {
      throw new Error(`No elements matching: ${textToLookFor}`);
    }
    return null;
  }

  public async findAsync(
    arr: Array<AppiumNextElementType>,
    asyncCallback: (opts: AppiumNextElementType) => Promise<boolean>
  ): Promise<AppiumNextElementType> {
    const promises = arr.map(asyncCallback);
    const results = await Promise.all(promises);
    const index = results.findIndex(result => result);
    return arr[index];
  }

  public async findMessageWithBody(textToLookFor: string): Promise<AppiumNextElementType> {
    await this.waitForTextElementToBePresent(new MessageBody(this, textToLookFor));
    const message = await this.findMatchingTextAndAccessibilityId('Message body', textToLookFor);
    return message;
  }

  /**
   * Attempts to visually match a reference image against all instances found by the given locator, and taps the best match.
   * All element screenshots are taken in parallel.
   * If the method finds 0 results for a locator, retries with exponential backoff up to 5 seconds.
   *
   * @param locator - The strategy and selector to find candidate elements.
   * @param referenceImageName - The filename of the reference image (in the media directory).
   * @throws If no suitable match is found among the candidate elements.
   */
  public async matchAndTapImage(
    candidates: PickerCandidates,
    referenceImageName: string
  ): Promise<void> {
    const threshold = 0.85;
    const { type, name } = candidates;

    const referencePath = path.join(mediaFolder, referenceImageName);
    await fs.access(referencePath).catch(() => {
      throw new Error(`Reference image not found: ${referencePath}`);
    });
    const referenceBuffer = await fs.readFile(referencePath);

    /**
     * The picker's grid populates after its chrome does, so an empty result means "not yet", not "not
     * there". `Collections` resolves while the grid is still loading, and everything queried at that
     * moment belongs to the app underneath the sheet.
     */
    let source = await this.getPageSource();
    let rects = parsePickerRects(source, type, name);
    if (rects.length === 0) {
      const deadline = Date.now() + 10_000;
      while (rects.length === 0 && Date.now() < deadline) {
        await sleepFor(500);
        source = await this.getPageSource();
        rects = parsePickerRects(source, type, name);
      }
    }

    this.info(
      `[matchAndTapImage] ${rects.length} candidates of type ${type}${name ? ` named "${name}"` : ''}`
    );

    /**
     * One screenshot for the whole screen, cropped locally per candidate.
     *
     * The alternative is an element screenshot each, and those are round-trips that WDA serialises — so
     * they cost the same whether issued together or in sequence. Measured on the profile-picture picker:
     * 586ms per element screenshot against 1352ms for the page source that yields every rect at once.
     */
    const screenshot = Buffer.from(await this.getScreenshot(), 'base64');
    const shot = sharp(screenshot);
    const shotMeta = await shot.metadata();
    /** Screenshots are in device pixels and the tree is in points, so everything scales by this. */
    const scale = (shotMeta.width ?? 1) / windowWidthFromSource(source);

    const results = await Promise.all(
      rects.map(async rect => {
        const crop = {
          left: Math.round(rect.x * scale),
          top: Math.round(rect.y * scale),
          width: Math.round(rect.width * scale),
          height: Math.round(rect.height * scale),
        };
        try {
          const cropped = await sharp(screenshot).extract(crop).toBuffer();
          const resizedRef = await sharp(referenceBuffer)
            .resize(crop.width, crop.height)
            .toBuffer();
          const { score } = await getImageOccurrence(cropped, resizedRef, { threshold: -1 });
          return { rect, score };
        } catch {
          return null;
        }
      })
    );

    const best = results
      .filter((r): r is { rect: PickerRect; score: number } => r !== null)
      .reduce<{
        rect: PickerRect;
        score: number;
      } | null>((acc, r) => (!acc || r.score > acc.score ? r : acc), null);

    if (!best || best.score < threshold) {
      throw new Error(
        `[matchAndTapImage] No candidate matched ${referenceImageName} above ${threshold} among ` +
          `${rects.length} of type ${type}${name ? ` named "${name}"` : ''}. Best score: ` +
          `${best ? best.score.toFixed(3) : 'none'}.`
      );
    }

    /**
     * The reference is resized to the candidate's own size, so a match covers the whole crop and its
     * centre is the candidate's centre. Tapping that directly is what the previous scaling correction
     * arrived at, without a second point/pixel conversion to get wrong.
     */
    await clickOnCoordinates(this, {
      x: Math.round(best.rect.x + best.rect.width / 2),
      y: Math.round(best.rect.y + best.rect.height / 2),
    });
  }

  /**
   * Checks if an element exists on the screen without throwing an error.
   * Only useful for scenarios where you want to interact with an element if it exists
   * but don't care if it doesn't.
   * For explicit verification of present or not present, use either
   * waitForTextElementToBePresent or verifyElementNotPresent.
   *
   * @param args - Element locator with optional text matching and timeout
   * @param args.text - Optional text content to match within elements
   * @param args.maxWait - Maximum time to wait in ms (default: 60000)
   * @returns The element if found, null otherwise
   */
  public async doesElementExist(
    args: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<AppiumNextElementType | null> {
    try {
      const locatorArgs =
        args instanceof LocatorsInterface
          ? { ...args.build(), text: args.text, maxWait: args.maxWait, skipHealing: true }
          : { ...args, skipHealing: true };
      return await this.waitForTextElementToBePresent(locatorArgs);
    } catch {
      return null;
    }
  }

  /**
   * Ensures an element is not visible on the screen at the end of the wait time.
   * This allows any transitions to complete and tolerates some UI flakiness.
   * Unlike hasElementBeenDeleted, this doesn't require the element to exist first.
   *
   * @param args - Locator (LocatorsInterface or StrategyExtractionObj) with optional properties
   * @param args.text - Optional text content to match within elements
   * @param args.maxWait - Maximum time to wait before checking (defaults to 2000ms)
   *
   * @throws Error if the element is found
   *
   */
  public async verifyElementNotPresent(
    args: {
      text?: string;
      maxWait?: number;
    } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<void> {
    const { locator, description } = this.resolveLocator(args);
    const maxWait = args.maxWait || 2_000;

    // Wait for any transitions to complete
    await sleepFor(maxWait);

    const element = await this.findElementQuietly(locator, args.text);

    if (element) {
      // Elements can disappear in the GUI but still be present in the DOM
      let isVisible: boolean;
      try {
        isVisible = await this.isVisible(element.ELEMENT);
      } catch (e) {
        // Stale reference or other error checking visibility
        const errorMsg = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Element with ${description} has stale reference or error checking visibility: ${errorMsg}`
        );
      }

      if (isVisible) {
        throw new Error(
          `Element with ${description} is visible after ${maxWait}ms when it should not be`
        );
      }
      // Element exists but not visible - that's okay
      this.log(`Element with ${description} exists but is not visible`);
    } else {
      this.log(`Verified no element with ${description} is present`);
    }
  }

  /**
   * Fast "element is gone" check: polls until the element is absent, confirmed by 3 consecutive
   * misses (a built-in debounce against flicker/reappear), and returns as soon as that holds —
   * so it's near-instant when the element is already gone. Unlike `hasElementBeenDeleted`, it does
   * NOT require the element to be present first, so it's safe for "already gone" cases.
   *
   * Use this instead of `verifyElementNotPresent` ONLY when the intent is "this UI element is gone
   * after an action". Do NOT use it to prove "a message/content never arrives over a window"
   * (absent-now != absent-later there) — keep `verifyElementNotPresent` for those.
   */
  public async waitForElementToBeGone(
    args: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<void> {
    const { locator, description } = this.resolveLocator(args);
    const maxWait = args.maxWait ?? 5_000;
    await this.waitForElementToDisappear(locator, maxWait, args.text);
    this.log(`Confirmed element gone: ${description}`);
  }

  /**
   * Waits for an element to disappear from screen (using the Disappearing Messages feature)
   *
   * @param args - Locator (LocatorsInterface or StrategyExtractionObj) with optional properties
   * @param args.actualStartTime - Timestamp of when the timer should be considered to have started.
   * @param args.text - Optional text content to match within elements of the same type
   * @param args.initialMaxWait - Time to wait for element to initially appear (defaults to 10_000ms)
   * @param args.maxWait - Time to wait for deletion AFTER element is found (defaults to 30_000ms)
   *
   * @throws Error if:
   * - The element is never found within initialMaxWait
   * - The element still exists after maxWait
   * - The element disappears suspiciously early
   *
   * Note:
   * - If you want to ensure an element was present but disappeared (without Disappearing Messages logic), use hasElementBeenDeleted().
   * - If you want to ensure an element is no longer visible (regardless of prior existence), use verifyElementNotPresent().
   */
  public async hasElementDisappeared(
    args: {
      actualStartTime: number;
      text?: string;
      initialMaxWait?: number;
      maxWait?: number;
      expectedDuration?: number;
    } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<void> {
    const { locator, description } = this.resolveLocator(args);
    const text = args.text;
    const initialMaxWait = args.initialMaxWait ?? 10_000;
    const maxWait = args.maxWait ?? 30_000;

    // Phase 1: Wait for element to appear
    this.log(`Waiting for element with ${description} to be deleted...`);
    await this.waitForElementToAppear(locator, initialMaxWait, text);
    const foundTime = Date.now();
    this.log(`Element with ${description} has been found, now waiting for deletion`);

    // Phase 2: Wait for element to disappear
    await this.waitForElementToDisappear(locator, maxWait, text);

    // Elements should not disappear too early (could be a DM bug)
    const totalTime = (Date.now() - args.actualStartTime) / 1000;
    const deletionPhaseTime = (Date.now() - foundTime) / 1000;

    // Prefer an explicit `expectedDuration` (the disappearing timer itself) over inferring it from
    // `maxWait`, which is the timer PLUS an allowance for send/propagation/poll debounce. Inferring
    // works at 30s, where the allowance is small relative to the timer, but not at 10s: there the
    // allowance is a third of the total, so a floor derived from the padded timeout lands above the
    // real deletion time and rejects a perfectly good run.
    //
    // The two factors differ because they measure different things. Against the real timer we can
    // be strict (0.8); against a padded timeout we have to stay loose (0.65) or we'd reject callers
    // that are behaving correctly. Callers still on the inferred path keep exactly their previous
    // behaviour.
    const expectedTotalTime = (args.expectedDuration ?? maxWait) / 1000;
    const minAcceptableTotalTimeFactor = args.expectedDuration ? 0.8 : 0.65;
    const minAcceptableTotalTime = expectedTotalTime * minAcceptableTotalTimeFactor;

    if (totalTime < minAcceptableTotalTime) {
      throw new Error(
        `Element with ${description} disappeared suspiciously early: ${totalTime.toFixed(1)}s total ` +
          `(found after ${((foundTime - args.actualStartTime) / 1000).toFixed(1)}s, ` +
          `deleted after ${deletionPhaseTime.toFixed(1)}s). ` +
          `Expected ~${expectedTotalTime}s total.`
      );
    }

    this.log(
      `Element with ${description} has been deleted after ${totalTime.toFixed(1)}s total time`
    );
  }
  /**
   * Wait for an element to appear on screen
   */
  private async waitForElementToAppear(
    locator: StrategyExtractionObj,
    timeout: number,
    text?: string
  ): Promise<void> {
    const desc = describeLocator({ ...locator, text });

    const element = await this.pollUntil(
      async () => {
        const foundElement = await this.findElementQuietly(locator, text);
        return foundElement
          ? { success: true, data: foundElement }
          : { success: false, error: `Element with ${desc} not found` };
      },
      {
        maxWait: timeout,
        pollInterval: 100,
      }
    );

    if (!element) {
      throw new Error(
        `Element with ${desc} was never found within ${timeout}ms - cannot verify deletion of non-existent element`
      );
    }
  }

  /**
   * Wait for an element to disappear with debouncing for flaky UI states.
   * Requires 3 consecutive checks where element is not found/invisible/stale
   * to confirm deletion. This prevents false positives during transitions.
   */
  private async waitForElementToDisappear(
    locator: StrategyExtractionObj,
    timeout: number,
    text?: string
  ): Promise<void> {
    const start = Date.now();
    const requiredConsecutiveMisses = 3;
    let consecutiveMisses = 0;

    while (Date.now() - start < timeout) {
      const element = await this.findElementQuietly(locator, text);

      if (!element) {
        // Element not found
        consecutiveMisses++;
        if (consecutiveMisses >= requiredConsecutiveMisses) {
          return; // Confirmed deleted
        }
      } else {
        // Element found - check visibility
        try {
          const isVisible = await this.isVisible(element.ELEMENT);
          if (!isVisible) {
            consecutiveMisses++;
            if (consecutiveMisses >= requiredConsecutiveMisses) {
              return; // Confirmed invisible
            }
          } else {
            // Element is visible - reset counter
            consecutiveMisses = 0;
          }
        } catch (e) {
          // Stale element reference or other error
          consecutiveMisses++;
          if (consecutiveMisses >= requiredConsecutiveMisses) {
            return; // Confirmed stale/gone
          }
        }
      }

      await sleepFor(100);
    }

    const desc = describeLocator({ ...locator, text });

    throw new Error(
      `Element with ${desc} was still present and visible after ${timeout}ms deletion timeout`
    );
  }

  /**
   * Find an element without throwing errors, logging or healing.
   */
  private async findElementQuietly(
    locator: StrategyExtractionObj,
    text?: string
  ): Promise<AppiumNextElementType | null> {
    try {
      if (text) {
        const elements = await this.findElements(locator.strategy, locator.selector, true);
        for (const element of elements) {
          const elementText = await this.getText(element.ELEMENT);
          if (elementText && elementText.toLowerCase() === text.toLowerCase()) {
            return element;
          }
        }
        return null;
      }
      // A `label` on the locator narrows the "is it gone" question the same way it narrows "is it
      // present". Without this an id shared by several rows - a pin marker, say - reports "still there"
      // off a DIFFERENT row's copy, and the wait can never pass while any of them survives.
      const label = 'label' in locator ? locator.label : undefined;
      if (label) {
        const elements = await this.findElements(locator.strategy, locator.selector, true);
        return await this.findMatchingLabelInElementArray(elements, label);
      }
      return await this.findElement(locator.strategy, locator.selector, true);
    } catch {
      return null;
    }
  }

  /**
   * Checks if an element is visible on the screen.
   * For Android, checks the 'displayed' attribute.
   * For iOS, checks the 'visible' attribute.
   */
  private async isVisible(elementId: string): Promise<boolean> {
    if (this.isAndroid()) {
      try {
        const displayed = await this.getAttribute('displayed', elementId);
        return displayed === 'true';
      } catch {
        return false;
      }
    }
    if (this.isIOS()) {
      try {
        const visible = await this.getAttribute('visible', elementId);
        return visible === 'true';
      } catch {
        return false;
      }
    }
    throw new Error('Unsupported platform');
  }

  public async hasTextElementBeenDeleted(accessibilityId: AccessibilityId, text: string) {
    const fakeError = `${accessibilityId}: has been found, but shouldn't have been. OOPS`;
    try {
      await this.findMatchingTextAndAccessibilityId(accessibilityId, text);
      throw new Error(fakeError);
    } catch (e: any) {
      if (e.message === fakeError) {
        throw e;
      }
    }
    this.log(accessibilityId, ': ', text, 'is not visible, congratulations');
  }
  // WAIT FOR FUNCTIONS

  /**
   * Waits for an element to be present with optional text matching and self-healing.
   * Continuously polls for maxWait seconds, then attempts healing as last resort if not found.
   *
   * @param args - Locator and options (text, maxWait, skipHealing)
   * @returns Promise resolving to the found element
   * @throws If element not found
   */
  public async waitForTextElementToBePresent(
    args: { text?: string; label?: string; maxWait?: number; skipHealing?: boolean } & (
      | LocatorsInterface
      | StrategyExtractionObj
    )
  ): Promise<AppiumNextElementType> {
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    // Prefer text from args (if passed directly), otherwise check locator
    const text = args.text ?? ('text' in locator ? locator.text : undefined);
    const label = args.label ?? ('label' in locator ? locator.label : undefined);

    const { maxWait = 30_000 } = args;
    const skipHealing = 'skipHealing' in args ? (args.skipHealing ?? false) : false;

    const description = describeLocator({ ...locator, text, label });
    this.log(`Waiting for element with ${description} to be present`);

    // Helper function to find element with or without healing
    const tryFindElement = async (allowHealing: boolean): Promise<AppiumNextElementType | null> => {
      try {
        if (label) {
          const els = await this.findElements(locator.strategy, locator.selector, !allowHealing);
          return await this.findMatchingLabelInElementArray(els, label);
        }
        if (text) {
          const els = await this.findElements(
            locator.strategy,
            locator.selector,
            !allowHealing,
            text
          );
          return await this.findMatchingTextInElementArray(els, text);
        }
        return await this.findElement(locator.strategy, locator.selector, !allowHealing);
      } catch (err) {
        return null;
      }
    };

    const result = await this.pollUntil(
      async () => {
        const element = await tryFindElement(false); // No healing during polling
        return element
          ? { success: true, data: element }
          : { success: false, error: `Element with ${description} not found` };
      },
      { maxWait }
    ).catch(async originalError => {
      // If healing is disabled, re-throw original error
      if (skipHealing) throw originalError;

      // One attempt at healing after polling fails
      const element = await tryFindElement(true);
      if (element) {
        // Healing succeeded
        return element;
      }
      // A system ANR dialog covers the app, so the element is genuinely absent from the tree even
      // though nothing is wrong with the app or the locator. Dismiss it and retry once.
      //
      // Must stay BELOW the `skipHealing` early-throw: the check below looks an element up itself,
      // via `doesElementExist`, which sets `skipHealing` — that early return is the only thing
      // stopping a failed ANR probe from recursing into another ANR probe.
      if (await this.dismissSystemAnrIfPresent()) {
        const afterAnr = await tryFindElement(true);
        if (afterAnr) {
          return afterAnr;
        }
      }

      // Healing failed, re-throw original error
      throw originalError;
    });
    // Element was found as-is
    this.log(`Element with ${description} has been found`);
    return result!; // Result must exist if we reached this point
  }

  /**
   * How many system ANR dialogs this device may absorb before the run is called unhealthy.
   *
   * One is treated as bad luck; a second says the host is saturated rather than the app being slow,
   * and every failure after that is noise attributed to whatever spec happened to be running.
   */
  private static readonly MAX_ANR_DISMISSALS = 1;
  private anrDismissals = 0;

  /**
   * Dismisses an Android "isn't responding" dialog if one is covering the app, and reports whether
   * it did.
   *
   * This is not a product failure and usually not even Session's: the one that prompted this was
   * `com.android.systemui` freezing under host load, which put a modal over everything and made
   * ordinary elements unfindable. Left unhandled it surfaces as "element not found" attributed to
   * whichever spec was unlucky, which is how it stayed unexplained for a day.
   *
   * "Wait" rather than "Close app" deliberately — killing the frozen component would take the app
   * under test with it when the ANR *is* ours.
   *
   * Past [MAX_ANR_DISMISSALS] it throws instead, so a saturated machine is reported as a saturated
   * machine in the test results rather than absorbed silently. That is the point of the cap: one
   * dismissal keeps a run alive, a stream of them is information we want surfaced.
   */
  private async dismissSystemAnrIfPresent(): Promise<boolean> {
    if (!this.isAndroid()) {
      return false;
    }

    const wait = await this.doesElementExist({
      strategy: 'id',
      selector: 'android:id/aerr_wait',
      maxWait: 1000,
    }).catch(() => null);

    if (!wait) {
      return false;
    }

    let title = 'unknown component';
    try {
      const titleEl = await this.findElement('id', 'android:id/alertTitle');
      title = await this.getTextFromElement(titleEl);
    } catch {
      // Title is for the error message only; its absence must not mask the ANR itself.
    }

    this.anrDismissals += 1;
    if (this.anrDismissals > DeviceWrapper.MAX_ANR_DISMISSALS) {
      throw new Error(
        `System ANR: "${title}" — ${this.anrDismissals} not-responding dialogs on ` +
          `${this.getDeviceIdentity()} in one test. The host is saturated, not the app under test; ` +
          `reduce concurrent emulators/simulators or restart them. Element lookups will keep ` +
          `failing while a dialog is covering the app.`
      );
    }

    this.log(`Dismissing ANR dialog ("${title}") and retrying`);
    await this.click(wait.ELEMENT);
    return true;
  }

  public async waitForControlMessageToBePresent(
    text: string,
    maxWait = 15000
  ): Promise<AppiumNextElementType> {
    this.log(`Waiting for control message "${text}" to be present`);
    const result = await this.pollUntil(
      async () => {
        try {
          const els = await this.findElements('accessibility id', 'Control message');
          const element = await this.findMatchingTextInElementArray(els, text);

          return element
            ? { success: true, data: element }
            : { success: false, error: `Control message "${text}" not found` };
        } catch (err) {
          return {
            success: false,
            error: `Control message "${text}" not found`,
          };
        }
      },
      { maxWait }
    );

    if (!result) {
      throw new Error(`Waited too long for control message "${text}"`);
    }

    this.log(`Control message "${text}" has been found`);
    return result;
  }

  public async waitForLoadingMedia() {
    await this.pollUntil(
      async () => {
        const element = await this.findElementQuietly({
          strategy: 'id',
          selector: 'network.loki.messenger:id/thumbnail_load_indicator',
        });

        // Success when element is GONE
        return { success: !element };
      },
      { maxWait: 15_000 }
    );

    this.info('Loading animation has finished');
  }

  public async waitForLoadingOnboarding() {
    const locator = new LoadingAnimation(this).build();

    await this.pollUntil(
      async () => {
        const element = await this.findElementQuietly(locator);

        // Success when element is GONE
        return { success: !element };
      },
      { maxWait: 18_000 }
    );

    this.info('Loading animation has finished');
  }
  /**
   * Continuous polling utility for any async condition.
   */
  private async pollUntil<T>(
    fn: () => Promise<PollResult<T>>,
    {
      maxWait = 20_000,
      pollInterval = 100,
      onAttempt,
    }: {
      maxWait?: number;
      pollInterval?: number;
      onAttempt?: (attempt: number, elapsedMs: number) => void;
    } = {}
  ): Promise<T | undefined> {
    const start = Date.now();
    let elapsed: number;
    let attempt = 0;
    let lastError: string | undefined;

    do {
      try {
        const result = await fn();
        if (result.success) {
          elapsed = Date.now() - start;
          this.log(`Polling successful after ${attempt + 1} attempt(s) (${elapsed}ms)`);
          return result.data;
        }
        lastError = result.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      attempt++;
      elapsed = Date.now() - start;
      onAttempt?.(attempt, elapsed);

      // Only sleep if we're going to continue
      if (elapsed + pollInterval < maxWait) {
        await sleepFor(pollInterval);
      }
    } while (elapsed < maxWait);
    // Log the error with details but only throw generic error so that they get grouped in the report
    this.log(`${lastError} after ${attempt} attempts (${elapsed}ms)`);
    throw new Error(lastError || 'Polling failed');
  }
  /**
   * Waits for an element's screenshot to match a specific color.
   *
   * @param args - Element locator with optional text and maxWait
   * @param expectedColor - Hex color code (e.g., '04cbfe')
   * @throws If color doesn't match within timeout
   */

  public async waitForElementColorMatch(
    args: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj),
    expectedColor: string,
    tolerance?: number
  ): Promise<void> {
    const { locator, description } = this.resolveLocator(args);

    this.log(`Waiting for ${description} to have color #${expectedColor}`);

    await this.pollUntil(
      async () => {
        const element = await this.findElementQuietly(locator, args.text);

        if (!element) {
          return {
            success: false,
            error: `Element not found`,
          };
        }

        const base64 = await this.getElementScreenshot(element.ELEMENT);
        const actualColor = await parseDataImage(base64);
        const matches = isSameColor(expectedColor, actualColor, tolerance);

        return {
          success: matches,
          error: matches
            ? undefined
            : `Color mismatch: expected #${expectedColor}, got #${actualColor}`,
        };
      },
      {
        maxWait: args.maxWait, // Will use default from pollUntil if undefined
      }
    );
  }
  // UTILITY FUNCTIONS

  /**
   * Stamped at the send action, not at the sent tick below.
   *
   * Callers hand this to `hasElementDisappeared` as the moment the message's timer started, and that
   * check rejects a lifetime under 0.8x the timer as a product bug. The tick is only when Appium first
   * observes the send, so any delay in observing it is subtracted from the measured lifetime: on
   * devnet's 10s timer, two seconds of lag is enough to report a correct run as a bug. Reading it early
   * can only overstate the lifetime, and nothing checks for that.
   */
  public async sendMessage(message: string): Promise<number> {
    await this.inputText(message, new MessageInput(this));

    // Click send

    const sendButton = await this.clickOnElementAll(new SendButton(this));
    if (!sendButton) {
      throw new Error('Send button not found: Need to restart iOS emulator: Known issue');
    }
    const sentTimestamp = Date.now();
    // Wait for tick
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 50000,
    });
    return sentTimestamp;
  }

  public async sendNewMessage(user: Pick<StateUser, 'sessionId'>, message: string) {
    // Sender workflow
    // Click on plus button
    await this.clickOnElementAll(new PlusButton(this));
    // Select direct message option
    await this.clickOnElementAll(new NewMessageOption(this));
    // Enter User B's session ID into input box
    await this.inputText(user.sessionId, new EnterAccountID(this));
    // The keyboard covers Next on smaller screens, so it has to go — but by asking the driver, not by
    // scrolling. This is a bottom sheet: a swipe drags the sheet itself, and the tap that follows lands
    // on nothing, leaving the Account ID entered and Next untouched.
    await this.hideKeyboard();
    await this.clickOnElementAll(new NextButton(this));
    // Type message into message input box

    await this.inputText(message, new MessageInput(this));
    // Click send
    const sendButton = await this.clickOnElementAll(new SendButton(this));
    if (!sendButton) {
      throw new Error('Send button not found: Need to restart iOS emulator: Known issue');
    }
    // Wait for tick
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 50000,
    });

    return message;
  }

  public async acceptMessageRequestWithButton() {
    await this.clickOnElementAll(new MessageRequestsBanner(this));
    await this.clickOnElementAll(new MessageRequestItem(this));
    await this.clickOnElementAll(new AcceptMessageRequestButton(this));
  }

  // TODO instead of blind sleeping, check presence of reply preview
  // Remove blind sleep from other tests that reply as well
  public async replyToMessage(user: Pick<StateUser, 'userName'>, body: string) {
    // Reply to media message from user B
    // Long press on imageSent element
    await this.longPressMessage(new MessageBody(this, body));

    // Context menu is already open, just click Reply
    await this.clickOnByAccessibilityID('Reply to message');

    await sleepFor(500); // Let the UI settle back into composition mode
    // Select 'Reply' option
    // Send message
    const replyMessage = `${user.userName} replied to ${body}`;
    await this.sendMessage(replyMessage);

    return replyMessage;
  }

  public async measureSendingTime(messageNumber: number) {
    const message = `Test-message`;
    const timeStart = Date.now();

    await this.sendMessage(message);

    const timeEnd = Date.now();
    const timeMs = timeEnd - timeStart;

    this.log(`Message ${messageNumber}: ${timeMs}`);
    return timeMs;
  }

  public async inputText(
    textToInput: string,
    args: LocatorsInterface | ({ maxWait?: number } & StrategyExtractionObj),
    paste: boolean = false
  ) {
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    if (paste) {
      // Set clipboard, press key-code for instant paste
      await this.clickOnElementAll({ ...locator });
      if (this.isAndroid()) {
        await this.toAndroid().setClipboard(
          Buffer.from(textToInput).toString('base64'),
          'plaintext'
        );
        await this.toAndroid().pressKeyCode(279);
      } else {
        // Use native paste UI, accept perms if needed
        await this.toIOS().mobileSetPasteboard(textToInput);
        await this.toIOS().mobileGetPasteboard();
        await this.processPermissions({ strategy: 'accessibility id', selector: 'Allow Paste' });
        await this.clickOnElementAll({ ...locator });
        await this.clickOnByAccessibilityID('Paste');
      }
    } else {
      const el = await this.waitForTextElementToBePresent({ ...locator });
      await this.setValueImmediate(textToInput, el.ELEMENT);
    }
  }

  public async getAttribute(attribute: string, elementId: string) {
    return this.toShared().getAttribute(attribute, elementId);
  }

  /**
   * Poll an element's `value` attribute until it equals `expectedValue`, returning true as soon as
   * it matches (or false on timeout). The element is re-found each iteration because its ref can go
   * stale while the control updates. Use this instead of a fixed "sleep then read once" wait for an
   * async control (e.g. the Local Network permission switch flipping to '1' after mic/camera access
   * is granted) — it returns the moment the value flips rather than always paying the full wait.
   */
  public async waitForElementValue(
    locator: StrategyExtractionObj,
    expectedValue: string,
    maxWait: number = 10_000
  ): Promise<boolean> {
    const start = Date.now();
    do {
      const el = await this.doesElementExist({ ...locator, maxWait: 1_000 });
      if (el) {
        try {
          if ((await this.getAttribute('value', el.ELEMENT)) === expectedValue) {
            return true;
          }
        } catch {
          // Element went stale as the control updated — re-find on the next iteration.
        }
      }
      await sleepFor(300);
    } while (Date.now() - start < maxWait);
    return false;
  }

  public async assertAttribute(
    element: LocatorsInterface | StrategyExtractionObj,
    attribute: string,
    value: string
  ) {
    const el = await this.waitForTextElementToBePresent(element);
    const received = await this.getAttribute(attribute, el.ELEMENT);
    verify(received, 'Element attribute value mismatch').toBe(value);
  }

  public async disappearRadioButtonSelected(
    platform: SupportedPlatformsType,
    timeOption: DISAPPEARING_TIMES
  ) {
    if (platform === 'ios') {
      const radioButton = await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: `${timeOption} - Radio`,
      });
      const attr = await this.getAttribute('value', radioButton.ELEMENT);
      if (attr === 'selected') {
        this.log('Great success - default time is correct');
      } else {
        throw new Error('Dammit - default time was not correct');
      }
    } else {
      const radioButton = await this.waitForTextElementToBePresent({
        strategy: 'id',
        selector: timeOption,
      });
      const attr = await this.getAttribute('selected', radioButton.ELEMENT);
      if (!attr) {
        throw new Error('Dammit - default time was not correct');
      }
      this.log('Great success - default time is correct');
    }
  }

  public async pushMediaToDevice(
    mediaFileName:
      | 'animated_profile_picture_as_png.png'
      | 'animated_profile_picture.gif'
      | 'profile_picture.jpg'
      | 'test_file.pdf'
      | 'test_image.jpg'
      | 'test_video.mp4'
  ) {
    const filePath = path.join(mediaFolder, mediaFileName);
    await fs.access(filePath).catch(() => {
      throw new Error(`Media file not found: ${filePath}`);
    });
    if (this.isIOS()) {
      // Push file to simulator
      this.warn(
        `pushMediaToDevice on iOS is deprecated. Consider pre-loading it on simulator creation`
      );
      await runScriptOrThrow(`xcrun simctl addmedia ${this.udid} ${filePath}`, true);
    } else if (this.isAndroid()) {
      const ANDROID_DOWNLOAD_DIR = '/storage/emulated/0/Download';
      // Clear downloads folder at runtime before pushing
      await runScriptAndLog(
        `${getAdbFullPath()} -s ${this.udid} shell rm -rf ${ANDROID_DOWNLOAD_DIR}/*`,
        true
      );
      // Throws rather than logs: the clear above means a failed push leaves the device with NO media,
      // so the spec fails later on a missing picker entry with nothing pointing back here.
      await runScriptOrThrow(
        `${getAdbFullPath()} -s ${this.udid} push ${filePath} ${ANDROID_DOWNLOAD_DIR}`,
        true
      );
      // Asserted rather than assumed. `adb push` exiting 0 is not the same as the file being there,
      // and this is the check that survives whatever the next tool decides to print.
      const listing = await runScriptOrThrow(
        `${getAdbFullPath()} -s ${this.udid} shell ls ${ANDROID_DOWNLOAD_DIR}/${mediaFileName}`
      );
      if (!listing.includes(mediaFileName)) {
        throw new Error(
          `pushMediaToDevice: ${mediaFileName} is absent from ${this.udid} after the push (got "${listing.trim()}")`
        );
      }
      // Refreshes the photos UI to force the image to appear
      await runScriptAndLog(
        `${getAdbFullPath()} -s ${this.udid} shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://${ANDROID_DOWNLOAD_DIR}/${mediaFileName}`,
        true
      );
    }
  }

  public async sendImage(message: string, community?: boolean): Promise<number> {
    // iOS files are pre-loaded on simulator creation, no need to push
    if (this.isIOS()) {
      await this.clickOnElementAll(new AttachmentsButton(this));
      await this.clickOnElementAll(new ImagesFolderButton(this));
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Recents',
      });
      await this.matchAndTapImage({ type: 'XCUIElementTypeCell' }, testImage);
    } else if (this.isAndroid()) {
      // Push file first
      await this.pushMediaToDevice(testImage);
      await this.clickOnElementAll(new AttachmentsButton(this));
      await this.clickOnElementAll(new ImagesFolderButton(this));
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_allow_all_button',
        text: 'Allow all',
      });
      await sleepFor(500);
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'mediapicker-folder-item-thumbnail-0',
      });
      await sleepFor(100);
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'mediapicker-image-item-thumbnail-0',
      });
    }
    await this.inputText(message, new MessageInput(this));
    await this.clickOnElementAll(new SendButton(this));
    const sentTimestamp = Date.now();
    if (community) {
      await this.scrollToBottom();
    }
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    return sentTimestamp;
  }
  public async sendVideoiOS(message: string): Promise<number> {
    // iOS files are pre-loaded on simulator creation, no need to push
    await this.clickOnElementAll(new AttachmentsButton(this));
    await this.clickOnElementAll(new ImagesFolderButton(this));
    await this.modalPopup({
      strategy: 'accessibility id',
      selector: 'Allow Full Access',
    });
    await this.waitForTextElementToBePresent({ strategy: 'accessibility id', selector: 'Recents' });
    // A video can't be matched by its thumbnail so we use a video thumbnail file
    await this.matchAndTapImage({ type: 'XCUIElementTypeCell' }, testVideoThumbnail);
    const sentTimestamp = await this.sendMessage(message);
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    return sentTimestamp;
  }

  public async sendVideoAndroid(): Promise<number> {
    // Push first
    await this.pushMediaToDevice(testVideo);
    // Click on attachments button
    await this.clickOnElementAll(new AttachmentsButton(this));
    await sleepFor(100);
    // Select images button/tab
    await this.clickOnElementAll(new DocumentsFolderButton(this));
    await this.clickOnByAccessibilityID('Continue');
    // First you allow access then you allow full access
    await this.clickOnElementAll({
      strategy: 'id',
      selector: 'com.android.permissioncontroller:id/permission_allow_button',
      text: 'Allow',
    });
    await this.clickOnElementAll({
      strategy: 'id',
      selector: 'com.android.permissioncontroller:id/permission_allow_all_button',
    });
    // No fixed settle needed — the doesElementExist below already polls up to maxWait for the video.
    let videoElement = await this.doesElementExist({
      strategy: 'id',
      selector: 'android:id/title',
      text: testVideo,
      maxWait: 5000,
    });
    // This codepath is purely for the CI
    if (!videoElement) {
      // Try to reveal the video by selecting/filtering Videos in the native UI
      await this.clickOnElementAll({
        strategy: 'class name',
        selector: 'android.widget.Button',
        text: 'Videos',
      });
      // Try again to find the video file after filtering
      videoElement = await this.doesElementExist({
        strategy: 'id',
        selector: 'android:id/title',
        text: testVideo,
      });
    }
    if (videoElement) {
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'android:id/title',
        text: testVideo,
      });
    } else {
      throw new Error(`Video "${testVideo}" not found after attempting to reveal it.`);
    }
    const sentTimestamp = Date.now();
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    return sentTimestamp;
  }

  public async sendDocument(): Promise<number> {
    // iOS files are pre-loaded on simulator creation, no need to push
    if (this.isIOS()) {
      const formattedFileName = 'test_file, pdf';
      const testMessage = 'Testing documents';
      await this.clickOnElementAll(new AttachmentsButton(this));
      await this.clickOnElementAll(new DocumentsFolderButton(this));
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      // This flow is to ensure the file is found even if the simulator has been completely reset or started for the first time
      // The file is copied to the "Downloads" folder but the file picker UI might open in an empty "Recents" folder
      // If the file has been sent once before successfully, it should be found and sent immediately
      let fileFound = await this.doesElementExist({
        strategy: 'accessibility id',
        selector: formattedFileName,
        maxWait: 10000,
      });
      if (!fileFound) {
        await this.clickOnByAccessibilityID('Browse');
        fileFound = await this.doesElementExist({
          strategy: 'accessibility id',
          selector: formattedFileName,
          maxWait: 2000,
        });
        if (!fileFound) {
          await this.clickOnByAccessibilityID('Downloads');
        }
      }
      await this.clickOnByAccessibilityID(formattedFileName);
      await sleepFor(1_000); // Flaky UI doing flaky things
      await this.sendMessage(testMessage);
    } else if (this.isAndroid()) {
      await this.pushMediaToDevice(testFile);
      await this.clickOnElementAll(new AttachmentsButton(this));
      await this.clickOnElementAll(new DocumentsFolderButton(this));
      await this.clickOnByAccessibilityID('Continue');
      // First you allow access then you allow full access
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_allow_button',
        text: 'Allow',
      });
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_allow_all_button',
      });
      // No fixed settle needed — the doesElementExist below already polls up to maxWait for the file.
      let documentElement = await this.doesElementExist({
        strategy: 'id',
        selector: 'android:id/title',
        text: testFile,
        maxWait: 5000,
      });
      // This codepath is purely for the CI
      if (!documentElement) {
        // Try to reveal the pdf by selecting/filtering Documents in the native UI
        await this.clickOnElementAll({
          strategy: 'class name',
          selector: 'android.widget.Button',
          text: 'Documents',
        });
        // Try again to find the pdf file after revealing
        documentElement = await this.doesElementExist({
          strategy: 'id',
          selector: 'android:id/title',
          text: testFile,
        });
      }
      if (documentElement) {
        await this.clickOnElementAll({
          strategy: 'id',
          selector: 'android:id/title',
          text: testFile,
        });
      } else {
        throw new Error(`File "${testFile}" not found after attempting to reveal it.`);
      }
    }
    // Checking Sent status on both platforms
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    const sentTimestamp = Date.now();
    return sentTimestamp;
  }

  public async sendGIF(): Promise<number> {
    await this.clickOnElementAll(new AttachmentsButton(this));
    await this.clickOnElementAll(new GIFButton(this));
    await this.checkModalStrings(tStripped('giphyWarning'), tStripped('giphyWarningDescription'));
    await this.clickOnByAccessibilityID('Continue', 5000);
    await this.clickOnElementAll(new FirstGif(this));
    if (this.isIOS()) {
      await this.clickOnElementAll(new SendButton(this));
    }
    const sentTimestamp = Date.now();
    // Checking Sent status on both platforms
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    return sentTimestamp;
  }

  public async sendVoiceMessage(): Promise<number> {
    await this.longPress(new NewVoiceMessageButton(this));

    if (this.isAndroid()) {
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
        text: 'While using the app',
      });
    }
    if (this.isIOS()) {
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
    }

    await this.pressAndHold('New voice message');
    const sentTimestamp = Date.now();
    // Checking Sent status on both platforms
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    return sentTimestamp;
  }

  /**
   * Pick a display picture from the device's photo library and save it.
   *
   * `animated` drives the PICKER, not the file: it selects which label the picker is expected to show
   * (`GIF` against an image) and whether a crop step follows. `fileOverride` names the file to pick,
   * which is normally implied by `animated` and is separated from it only for the format-bypass spec —
   * there the file IS animated and the picker is expected to present it as an ordinary image, and the
   * whole question is whether the app agrees with the picker or with the bytes.
   */
  public async uploadProfilePicture(
    animated: boolean = false,
    fileOverride?: 'animated_profile_picture_as_png.png'
  ) {
    let uploadPicture:
      | 'animated_profile_picture_as_png.png'
      | 'animated_profile_picture.gif'
      | 'profile_picture.jpg';
    let dpLocator: LocatorsInterface;
    if (animated) {
      uploadPicture = animatedProfilePicture;
      dpLocator = new GIFName(this);
    } else {
      uploadPicture = profilePicture;
      dpLocator = new ImageName(this);
    }
    if (fileOverride) {
      uploadPicture = fileOverride;
    }

    await this.clickOnElementAll(new UserSettings(this));
    // Click on Profile picture
    await this.clickOnElementAll(new UserAvatar(this));
    await this.clickOnElementAll(new ChangeProfilePictureButton(this));
    // iOS files are pre-loaded on simulator creation, no need to push
    if (this.isIOS()) {
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Collections',
      });
      // Named, not every image on screen: the app behind the sheet contributes its own, and only the
      // grid's thumbnails carry this name.
      await this.matchAndTapImage(
        { type: 'XCUIElementTypeImage', name: 'PXGGridLayout-Info' },
        uploadPicture
      );
      await this.clickOnByAccessibilityID('Done');
    } else if (this.isAndroid()) {
      // Push file first
      await this.pushMediaToDevice(uploadPicture);
      await this.clickOnElementAll(new ImagePermissionsModalAllow(this));
      // clickOnElementAll below already waits for the 'Image button' — no fixed settle needed.
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'Image button',
      });
      await sleepFor(500);
      await this.clickOnElementAll(dpLocator);
      if (!animated) {
        await this.clickOnElementById('network.loki.messenger:id/crop_image_menu_crop');
      }
    }
    await this.clickOnElementAll(new SaveProfilePictureButton(this));
  }

  public async mentionContact(
    platform: SupportedPlatformsType,
    contact: Pick<StateUser, 'userName'>
  ) {
    await this.inputText(`@`, new MessageInput(this));
    // Check that all users are showing in mentions box
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Mentions list',
    });

    // Select User B (Bob) on device 1 (Alice's device)
    if (platform === 'android') {
      await this.clickOnElementAll({
        strategy: 'accessibility id',
        selector: 'Contact mentions',
        text: contact.userName,
      });
    } else {
      await this.clickOnElementAll(new Contact(this, contact.userName));
    }
    await this.clickOnElementAll(new SendButton(this));
    await this.waitForTextElementToBePresent(new OutgoingMessageStatusSent(this));
  }

  public async trustAttachments(conversationName: string) {
    // I kept getting stale element references on iOS in this method
    // This is an attempt to let the UI settle before we look for the untrusted attachment
    if (this.isIOS()) {
      await sleepFor(1000);
    }

    await this.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Untrusted attachment message',
    });
    await this.checkModalStrings(
      tStripped(`attachmentsAutoDownloadModalTitle`),
      tStripped(`attachmentsAutoDownloadModalDescription`, { conversation_name: conversationName })
    );
    await this.clickOnElementAll(new DownloadMediaButton(this));
  }

  // ACTIONS
  public async swipeLeftAny(selector: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector,
    });

    const loc = await this.getElementRect(el.ELEMENT);
    this.log(loc);

    if (!loc) {
      throw new Error('did not find element rectangle');
    }
    await this.scroll(
      { x: loc.x + loc.width, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width / 2, y: loc.y + loc.height / 2 },
      1000
    );

    this.info('Swiped left on ', selector);
  }

  // Swipe horizontally from 20% to 80% of screen width at the vertical center
  public async swipeRight() {
    const { width, height } = await this.getWindowRect();
    await this.scroll({ x: width * 0.2, y: height / 2 }, { x: width * 0.8, y: height / 2 }, 100);
  }

  public async swipeLeft(accessibilityId: AccessibilityId, text: string) {
    const el = await this.findMatchingTextAndAccessibilityId(accessibilityId, text);

    const loc = await this.getElementRect(el.ELEMENT);
    this.log(loc);

    if (!loc) {
      throw new Error('did not find element rectangle');
    }
    await this.scroll(
      { x: loc.x + loc.width, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width / 2, y: loc.y + loc.height / 2 },
      1000
    );

    this.info('Swiped left on ', el);
    // let some time for swipe action to happen and UI to update
  }

  /** Whether a soft keyboard is currently on screen. */
  public async isKeyboardShown(): Promise<boolean> {
    if (this.isIOS()) {
      return (
        (await this.doesElementExist({
          strategy: 'class name',
          selector: 'XCUIElementTypeKeyboard',
          maxWait: 500,
        })) !== null
      );
    }
    return this.toShared()
      .isKeyboardShown()
      .catch(() => false);
  }

  /**
   * Dismisses the soft keyboard if one is up, so a control it was covering becomes tappable.
   *
   * Reach for this rather than `scrollDown` when the goal is "get the keyboard out of the way".
   * `scrollDown` is a raw swipe, not a scroll-container operation, so on a bottom sheet it drags the
   * *sheet* — which leaves the target still present and findable (the click therefore succeeds and
   * throws nothing) while the tap lands outside its clickable region. That failure is silent: no
   * error, no navigation, nothing in the device log.
   *
   * **`mobile: hideKeyboard` is not enough on iOS.** It throws for two different reasons — there was no
   * keyboard, and there is one the driver has no affordance to dismiss (a plain text field offers it no
   * Done key) — and treating both as success means a keyboard that is still up reports as dismissed.
   * So the outcome is checked rather than assumed, and a tap outside the input is the fallback: that is
   * what dismisses this one, and it is inert on a screen with nothing under it.
   */
  /**
   * Best-effort. `mobile: hideKeyboard` throws both when there was no keyboard and when there is one the
   * driver has no affordance to dismiss — a plain message input is the second — so the outcome is checked
   * rather than taken from the call returning.
   *
   * `tapOutsideTheInput` adds a tap in the middle of the screen for the case the driver cannot handle.
   * Only a caller that knows what occupies that point should ask for it: on a bottom sheet it is the
   * sheet's own content, and a tap there can follow a link out of the app entirely.
   */
  public async hideKeyboard(options?: { tapOutsideTheInput?: boolean }): Promise<void> {
    if (!(await this.isKeyboardShown())) {
      return;
    }

    try {
      await this.toShared().execute('mobile: hideKeyboard', {});
    } catch {
      this.info('The driver could not dismiss the keyboard');
    }

    if (!(await this.isKeyboardShown())) {
      return;
    }

    if (!options?.tapOutsideTheInput) {
      this.info('Keyboard is still showing and this caller did not ask for the tap fallback');
      return;
    }

    // Above any keyboard and below any header.
    const { height, width } = await this.getWindowRect();
    await this.clickOnCoordinates(Math.round(width / 2), Math.round(height * 0.35));

    if (await this.isKeyboardShown()) {
      this.info('Keyboard is still showing after both attempts to dismiss it');
    }
  }

  // Swipe vertically from 70% to 30% of screen height at the horizontal center
  public async scrollDown() {
    const { width, height } = await this.getWindowRect();
    await this.scroll({ x: width / 2, y: height * 0.7 }, { x: width / 2, y: height * 0.3 }, 100);
  }

  // Swipe vertically from 30% to 70% of screen height at the horizontal center
  public async scrollUp() {
    const { width, height } = await this.getWindowRect();
    await this.scroll({ x: width / 2, y: height * 0.3 }, { x: width / 2, y: height * 0.7 }, 100);
  }

  // Swipe vertically from 95% to 35% of screen height at the horizontal center
  public async swipeFromBottom(): Promise<void> {
    const { width, height } = await this.getWindowRect();

    await this.scroll({ x: width / 2, y: height * 0.95 }, { x: width / 2, y: height * 0.35 }, 100);
  }

  public async scrollToBottom() {
    // The scroll-to-bottom button only exists when the conversation isn't already at the bottom.
    // Callers reach here with the message view already rendered (e.g. after awaiting a message), so
    // if the button applies it's already in the tree — a short probe is enough. `maxWait` only
    // bounds the ABSENT case (a present button returns as soon as it's found), so keeping this low
    // avoids burning the full wait every time the view opens already at the bottom.
    const button = await this.doesElementExist({
      ...new ScrollToBottomButton(this).build(),
      maxWait: 1_000,
    });
    if (!button) {
      this.info('Scroll button not found, continuing');
      return;
    }
    // Tap the handle the probe returned rather than looking it up again: the button removes itself
    // as soon as the list reaches the bottom (an incoming message auto-scrolling is enough), and a
    // second lookup would wait the default 60s and then throw — turning a best-effort helper into a
    // test failure.
    try {
      await this.click(button.ELEMENT);
    } catch {
      // Losing it between the probe and the tap means we're already where we wanted to be.
      this.info('Scroll button disappeared before it could be tapped, continuing');
    }
  }
  public async pullToRefresh(): Promise<void> {
    const { width, height } = await this.getWindowRect();
    await this.scroll({ x: width / 2, y: height * 0.15 }, { x: width / 2, y: height * 0.55 }, 200);
  }

  public async navigateBack(newAndroid: boolean = true) {
    if (this.isIOS()) {
      await this.clickOnByAccessibilityID('BackButton');
      return;
    } else if (this.isAndroid()) {
      const newLocator = {
        strategy: 'id',
        selector: 'Navigate back',
      } as StrategyExtractionObj;
      const legacyLocator = {
        strategy: 'accessibility id',
        selector: 'Navigate up',
      } as StrategyExtractionObj;
      // Prefer new locator if newAndroid is true, otherwise prefer legacy
      const [primary, fallback] = newAndroid
        ? [newLocator, legacyLocator]
        : [legacyLocator, newLocator];
      const el = await this.findWithFallback(primary, fallback);
      await this.click(el.ELEMENT);
    }
  }

  public async backToSession() {
    if (this.isIOS()) {
      await clickOnCoordinates(this, InteractionPoints.BackToSession);
    } else if (this.isAndroid()) {
      await this.back();
    }
  }

  /* ======= Settings functions =========*/

  public async turnOnReadReceipts() {
    await this.navigateBack();
    await this.clickOnElementAll(new UserSettings(this));
    await this.clickOnElementAll(new PrivacyMenuItem(this));
    await this.clickOnElementAll(new ReadReceiptsButton(this));
    await this.navigateBack(false);
    await this.clickOnElementAll(new CloseSettings(this));
  }

  /**
   * Grants or revokes Android's runtime notification permission directly, so the system prompt is not
   * left to appear at a time of Android's choosing.
   *
   * From API 33 the `POST_NOTIFICATIONS` prompt fires the first time the app tries to post a
   * notification, which is whenever a message happens to arrive — so it can land in the middle of an
   * unrelated step and cover the screen. That produced "element not found" failures attributed to
   * whatever the spec was doing at the time; three separate red specs in one sweep turned out to be
   * this one dialog.
   *
   * Granting at install removes the race rather than reacting to it. `handleNotificationPermissions`
   * stays valid either way — it dismisses the dialog only if present, so it becomes a no-op.
   *
   * **To write a spec that asserts the prompt appears, revoke first and relaunch.** Revoking a granted
   * runtime permission makes Android kill the app process, so it has to happen before the app is in
   * use, not mid-flow.
   */
  public async setNotificationPermission(granted: boolean): Promise<void> {
    if (!this.isAndroid()) {
      return;
    }

    const action = granted ? 'grant' : 'revoke';
    // Deliberately not routed through runScriptAndLog: that logs failures and returns, and a silently
    // ungranted permission is exactly the state this exists to prevent.
    try {
      await this.toShared().execute('mobile: shell', {
        command: 'pm',
        args: [action, androidAppPackage, 'android.permission.POST_NOTIFICATIONS'],
      });
      this.log(`Notification permission ${granted ? 'granted' : 'revoked'}`);
    } catch (error) {
      this.log(`Could not ${action} POST_NOTIFICATIONS: ${(error as Error).message}`);
    }
  }

  public async processPermissions(locator: LocatorsInterface | StrategyExtractionObj) {
    const locatorConfig = locator instanceof LocatorsInterface ? locator.build() : locator;

    if (this.isAndroid()) {
      const permissions = await this.doesElementExist({
        ...locatorConfig,
        maxWait: 5_000,
      });

      if (permissions) {
        await this.clickOnElementAll(locatorConfig);
      }
      return;
    }

    if (this.isIOS()) {
      // Retrieve the currently active app information
      const activeAppInfo = await this.execute('mobile: activeAppInfo');
      // Switch the active context to the iOS home screen
      await this.updateSettings({
        defaultActiveApplication: 'com.apple.springboard',
      });

      try {
        // Execute the action in the home screen context.
        //
        // Matches the Android branch above. The dialog is normally already up by the time we look
        // (found on the first poll), so this ceiling costs nothing in the usual case — it's only
        // paid when no dialog ever arrives. Missing a slow one is expensive though: it goes on to
        // cover the home screen, and every subsequent step fails against a screen it can't reach,
        // far from any mention of permissions.
        const iosPermissions = await this.doesElementExist({
          ...locatorConfig,
          maxWait: 5_000,
        });

        if (iosPermissions) {
          // Handle based on strategy type
          await this.clickOnElementAll(locatorConfig);
        }
      } catch (e) {
        this.info('iosPermissions doesElementExist failed with: ', e);
        // Ignore any exceptions during the action
      }

      // Revert to the original app context
      await this.updateSettings({
        defaultActiveApplication: activeAppInfo.bundleId,
      });
      return;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async execute(toExecute: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (this.device as any).execute(toExecute);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async updateSettings(details: Record<string, any>) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (this.device as any).updateSettings(details);
  }

  public async modalPopup(args: { maxWait?: number } & StrategyExtractionObj, maxWait = 1000) {
    if (!this.isIOS()) {
      throw new Error('Not an ios device');
    }
    // Retrieve the currently active app information
    const activeAppInfo = await this.execute('mobile: activeAppInfo');
    // Switch the active context to the iOS home screen
    await this.updateSettings({
      defaultActiveApplication: 'com.apple.springboard',
    });

    try {
      // Execute the action in the home screen context
      // Honor the caller's maxWait (e.g. cleanPermissions passes a short 500ms probe for a
      // leftover modal that's normally absent). Only fall back to 3s for callers that expect a
      // permission dialog to actually appear (present-case → returns as soon as it's found).
      const iosPermissions = await this.doesElementExist({
        ...args,
        maxWait: args.maxWait ?? 3_000,
      });
      if (iosPermissions) {
        await this.clickOnElementAll({ ...args, maxWait });
      } else {
        this.info('No iOS Permissions modal visible to Appium');
      }
    } catch (e) {
      this.info('FAILED WITH', e);
      // Ignore any exceptions during the action
    }

    // Revert to the original app context
    await this.updateSettings({
      defaultActiveApplication: activeAppInfo.bundleId,
    });
    return;
  }

  // Sanitize strings by removing new lines and whitespace sequences
  /**
   * Collapse rendered whitespace so copy can be compared against its localized source.
   *
   * A client is free to break one localized string across lines — the "Open URL" confirmation renders
   * the interpolated URL as its own paragraph — and that layout is not part of what the string says.
   * Public because assertions outside this class compare rendered copy too.
   */
  public sanitizeString(input: string): string {
    // Handle space + newlines as a unit
    return input.replace(/\s*\n+/g, ' ').trim();
  }

  /**
   * Asserts that actual text matches expected text.
   *
   * A difference that survives {@link sanitizeString} but disappears once every run of whitespace is
   * collapsed is reported rather than thrown. The two clients disagree about redundant whitespace — a
   * doubled space in a source string renders as two on iOS and one on Android — so failing on it fails the
   * spec for something no reader of the app can see, on one platform only. Losing the difference silently
   * would be worse: the annotation surfaces as a step in the report, so the copy can still be corrected at
   * the source without the suite treating it as a defect in the app.
   *
   * Anything that survives the collapse is a real difference in the words and still throws.
   *
   * @throws Error if the texts differ by more than whitespace
   */
  private assertTextMatches(actual: string, expected: string, fieldName: string): void {
    const sanitizedActual = this.sanitizeString(actual);
    const sanitizedExpected = this.sanitizeString(expected);

    if (sanitizedExpected === sanitizedActual) {
      this.log(`${fieldName} is correct`);
      return;
    }

    const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ');
    if (collapseWhitespace(sanitizedExpected) === collapseWhitespace(sanitizedActual)) {
      const description = `${fieldName} matches except for whitespace.\nExpected: ${sanitizedExpected}\nActual: ${sanitizedActual}`;
      this.info(description);
      this.testInfo.annotations.push({ type: 'copy-whitespace', description });
      return;
    }

    throw new Error(
      `${fieldName} is incorrect.\nExpected: ${sanitizedExpected}\nActual: ${sanitizedActual}`
    );
  }

  /**
   * Checks modal heading and description text against expected values.
   * Uses fallback locators to support both new (id) and legacy (accessibility id) variants on Android.
   * @param expectedHeading - Expected modal heading string
   * @param expectedDescription - Expected modal description string
   * @throws Error if heading or description doesn't match expected text
   */
  public async checkModalStrings(expectedHeading: string, expectedDescription: string) {
    // Always try new first, fall back to legacy
    const newHeading = new ModalHeading(this).build();
    const legacyHeading = {
      strategy: 'accessibility id',
      selector: 'Modal heading',
    } as StrategyExtractionObj;

    const newDescription = new ModalDescription(this).build();
    const legacyDescription = {
      strategy: 'accessibility id',
      selector: 'Modal description',
    } as StrategyExtractionObj;

    // Locators
    const elHeading = await this.findWithFallback(newHeading, legacyHeading);
    const elDescription = await this.findWithFallback(newDescription, legacyDescription);

    // Actual text
    const actualHeading = await this.getTextFromElement(elHeading);
    const actualDescription = await this.getTextFromElement(elDescription);

    this.assertTextMatches(actualHeading, expectedHeading, 'Modal heading');
    this.assertTextMatches(actualDescription, expectedDescription, 'Modal description');
  }

  private async checkCTAStrings({
    heading,
    body,
    negativeButton,
    positiveButton,
    features,
  }: CTAConfig): Promise<void> {
    if (features && features.length > 3) {
      throw new Error('CTAs support maximum 3 features');
    }

    // CTA heading
    const elHeading = await this.waitForTextElementToBePresent(new CTAHeading(this));
    const actualHeading = await this.getTextFromElement(elHeading);
    this.assertTextMatches(actualHeading, heading, 'CTA heading');

    // iOS may split the body around inline images, producing multiple cta-body elements.
    // Wait for the first, then find all and check that the expected text appears in any of them.
    if (body === undefined) {
      return;
    }
    await this.waitForTextElementToBePresent(new CTABody(this));
    const { strategy, selector } = new CTABody(this).build();
    const bodyElements = await this.findElements(strategy, selector, true);
    const bodyTexts = await Promise.all(bodyElements.map(el => this.getTextFromElement(el)));
    const matchingText =
      bodyTexts.find(t => this.sanitizeString(t) === this.sanitizeString(body)) ?? bodyTexts[0];
    this.assertTextMatches(matchingText, body, 'CTA body');

    // CTA features if present
    if (features) {
      for (let i = 0; i < features.length; i++) {
        const elFeature = await this.waitForTextElementToBePresent(new CTAFeature(this, i));
        const actualFeature = await this.getTextFromElement(elFeature);
        this.assertTextMatches(actualFeature, features[i], `CTA feature ${i + 1}`);
      }
    }

    if (negativeButton) {
      const elNegative = await this.waitForTextElementToBePresent(new CTAButtonNegative(this));
      const actualNegative = await this.getTextFromElement(elNegative);
      this.assertTextMatches(actualNegative, negativeButton, 'CTA negative button');
    }

    if (positiveButton) {
      const elPositive = await this.waitForTextElementToBePresent(new CTAButtonPositive(this));
      const actualPositive = await this.getTextFromElement(elPositive);
      this.assertTextMatches(actualPositive, positiveButton, 'CTA positive button');
    }
  }

  public async checkCTA(type: CTAType): Promise<void> {
    await this.checkCTAStrings(ctaConfigs[type]);
  }

  public async verifyNoCTAShows(): Promise<void> {
    // A CTA appears synchronously with the action that triggers it, so a short absence window is
    // enough — no need for verifyElementNotPresent's default 2s per check.
    await Promise.all([
      this.verifyElementNotPresent({ ...new CTAHeading(this).build(), maxWait: 1_000 }),
      this.verifyElementNotPresent({ ...new CTABody(this).build(), maxWait: 1_000 }),
      this.verifyElementNotPresent({ ...new CTAButtonNegative(this).build(), maxWait: 1_000 }),
      this.verifyElementNotPresent({ ...new CTAButtonPositive(this).build(), maxWait: 1_000 }),
    ]);
  }

  /**
   * Close a CTA if one is showing, and report whether there was one.
   *
   * Never an assertion. A CTA raised off a status fetch is up or not depending on whether that fetch has
   * landed, so its presence races the test — but left up it swallows the interactions behind it and the
   * failure surfaces far from the cause. Callers that have just asserted a specific CTA can ignore the
   * return.
   *
   * `via` selects the mechanism and the trade-offs between them are on {@link CTADismissal}. The default
   * scrim tap closes the CTAs raised by an ordinary action; the Pro modals need `negativeButton`, and a
   * CTA with no negative button needs `closeButton`.
   */
  public async dismissCTA(via: CTADismissal = 'scrim', maxWait: number = 3_000): Promise<boolean> {
    const hasCTAAppeared = await this.doesElementExist({
      ...new CTAHeading(this).build(),
      maxWait,
    });
    this.log(`hasCTAAppeared: ${hasCTAAppeared ? 'true' : 'false'}`);
    if (!hasCTAAppeared) {
      return false;
    }
    this.log(`Dismissing CTA via ${via}`);
    switch (via) {
      case 'closeButton':
        await this.clickOnElementAll({
          strategy: 'accessibility id',
          selector: this.isIOS() ? 'Close button' : 'Close',
        });
        break;
      case 'negativeButton':
        await this.clickOnElementAll(new CTAButtonNegative(this));
        break;
      case 'scrim':
        await this.clickOnCoordinates(150, 150);
        break;
    }

    /**
     * Confirm it actually went, rather than that it was clicked.
     *
     * The click returns before the modal has finished closing, so the next step can land on the overlay
     * and fail looking for whatever is behind it — several steps from the dismissal, and reading as a
     * missing control rather than a modal that is still up: on Android a CTA can still be on screen when
     * a spec goes looking for the home screen, and the failure then names the plus button.
     *
     * Waits on the heading, the same element the presence check above reads, so a dismissal is confirmed
     * against the thing that defined the CTA as showing in the first place.
     */
    await this.verifyElementNotPresent({ ...new CTAHeading(this).build(), maxWait: 10_000 });

    return true;
  }

  /** === Session Pro === */

  /**
   * Restore/link this device to an existing account from its recovery phrase.
   * Fails if the account isn't found on the network.
   */
  public async restoreFromSeed(recoveryPhrase: string): Promise<void> {
    await restoreAccountNoFallback(this, recoveryPhrase);
  }

  /** === Profile === */

  /** Change this account's display name via settings, then return to the home screen. */
  public async changeDisplayName(name: string): Promise<void> {
    await this.clickOnElementAll(new UserSettings(this));
    await this.clickOnElementAll(new EditUsernameButton(this));
    await this.onIOS().deleteText(new UsernameInput(this));
    await this.onAndroid().clickOnElementAll(new ClearInputButton(this));
    await this.inputText(name, new UsernameInput(this));
    await this.clickOnElementAll(new SaveNameChangeButton(this));
    await this.waitForTextElementToBePresent(new UsernameDisplay(this, name));
    await this.clickOnElementAll(new CloseSettings(this));
  }

  /**
   * Assert that this account's display name is (or becomes) `name`. Opens settings
   * and polls the profile name — used on a linked device to wait for a synced change.
   */
  public async assertDisplayName(name: string): Promise<void> {
    // Poll with a REOPEN each iteration: an already-open settings screen does not
    // live-refresh when a config sync arrives, so we must close and reopen the
    // dialog to observe a synced name (mirrors the desktop linked-device flow).
    const deadline = Date.now() + 30_000;
    let lastError: unknown;
    do {
      try {
        await this.clickOnElementAll(new UserSettings(this));
        await this.waitForTextElementToBePresent({
          ...new UsernameDisplay(this, name).build(),
          maxWait: 1_000,
        });
        await this.clickOnElementAll(new CloseSettings(this));
        return;
      } catch (e) {
        lastError = e;
        await this.clickOnElementAll(new CloseSettings(this)).catch(() => {});
        await sleepFor(500);
      }
    } while (Date.now() < deadline);
    throw new Error(
      `assertDisplayName: "${name}" did not appear within 30s. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }

  /**
   * Register this device's account as a Session Pro subscriber against the dev
   * backend (fake payment). The provider is derived from the device platform.
   * NOTE: Pro becomes visible to this and any linked device without an app
   * restart — reopen the Pro/settings dialog to observe the new state.
   */
  public async subscribeToPro(user: StateUser): Promise<void> {
    const provider = this.isIOS() ? 'apple' : 'google';
    await makeAccountPro({ user, provider });
  }

  /**
   * Assert that Session Pro is active for this account by opening the profile
   * picture modal and checking the "Pro Activated" CTA. Does NOT restart the
   * app. Cross-platform observers waiting for a subscription to sync should call
   * this inside a retry that reopens the dialog between attempts.
   */
  public async assertProActive(): Promise<void> {
    await this.clickOnElementAll(new UserSettings(this));
    await this.clickOnElementAll(new UserAvatar(this));
    await this.waitForTextElementToBePresent(new ChangeProfilePictureButton(this));
    await this.clickOnElementAll(new ProAnimatedDisplayPictureModalDescription(this));
    await this.checkCTA('alreadyActivated');
  }

  /**
   * Assert that a Pro-gated feature is unlocked by sending a message longer than
   * the standard 2000-char cap and confirming it sends (a non-Pro account would
   * be blocked by the "longer messages" upgrade CTA instead).
   */
  public async assertProFeatureUnlocked(user: Pick<StateUser, 'sessionId'>): Promise<void> {
    const message = 'x'.repeat(2001);
    await this.sendNewMessage(user, message);
    await this.waitForTextElementToBePresent(new MessageBody(this, message));
  }

  /** Open the conversation whose left-pane name matches `convoName`. */
  public async openConversationWith(convoName: string): Promise<void> {
    // If a conversation is already open (e.g. this client just sent a message), the
    // conversation-list item isn't on screen — step back to the list first. The message
    // input box only exists inside a conversation, so it's our "am I in a thread?" signal.
    const insideConversation = await this.doesElementExist({
      ...new MessageInput(this).build(),
      maxWait: 2_000,
    });
    if (insideConversation) {
      await this.navigateBack();
    }
    await this.clickOnElementAll(new ConversationItem(this, convoName));
  }

  /** Wait until a message with exactly this text is present in the open conversation. */
  public async waitForMessage(text: string): Promise<void> {
    await this.waitForTextElementToBePresent(new MessageBody(this, text));
  }

  /**
   * Open a message's info screen and assert it lists exactly the Pro features it was sent with.
   *
   * The sharpest receiver-side Pro assertion available: the features travel *in the message* as a
   * bitset, so this names what this particular message carried rather than what the sender's profile
   * currently claims. A badge elsewhere only says "this person is Pro".
   *
   * `message` must match a message body exactly — the mobile matcher compares whole element text.
   */
  public async assertMessageProFeatures(
    message: string,
    features: ProMessageFeature[]
  ): Promise<void> {
    await this.longPressMessage(new MessageBody(this, message));
    // Both platforms' long-press menus list every action, so "Info" is one tap away — no overflow.
    await this.clickOnElementAll(new MessageInfoMenuItem(this));

    for (const feature of features) {
      await this.waitForTextElementToBePresent(new ProFeatureRow(this, proFeatureTestId(feature)));
    }

    // Back to the conversation, so this composes with whatever the spec does next.
    await this.navigateBack();
  }

  public async assertConversationHeaderProBadge(senderName: string): Promise<void> {
    await this.openConversationWith(senderName);
    // The badge follows the sender's profile rather than the message, so it can land after the text
    // does. Waited on generously rather than read once, or this fails on ordering.
    await this.waitForTextElementToBePresent({
      ...new ConversationHeaderProBadge(this).build(),
      maxWait: 60_000,
    });
  }

  /**
   * Set this account's display picture to the suite's animated GIF (see `IBaseDeviceWrapper`).
   *
   * Mobile's uploader takes the animated-vs-still choice as an argument, so this is a rename rather
   * than new behaviour — it exists to give the two platforms one signature, since desktop's uploader
   * cannot take that argument at all.
   */
  public async setAnimatedDisplayPicture(): Promise<void> {
    await this.uploadProfilePicture(true);
  }

  /**
   * Assert this account's OWN display picture renders animated (see `IBaseDeviceWrapper`).
   *
   * The settings avatar is the only place mobile draws the local user's picture large enough to
   * sample, so this navigates there rather than reading whatever is on screen, and closes settings
   * behind itself — it ends on the home screen whichever screen it started on.
   *
   * Callable from anywhere the app can reach settings in one step, because the callers genuinely are
   * in three different places: the client that just uploaded is left INSIDE settings, a linked device
   * that waited for a message is INSIDE a conversation, and a fresh one is on the home screen. Both
   * wrong starts fail late and misleadingly — a blind tap on the user-settings button from settings
   * opens the avatar modal instead, and from a conversation there is no such button at all — so each
   * is probed for rather than assumed. The settings probe is the Privacy row (settings-only, near the
   * top so it needs no scroll, addressed by id on both platforms); the conversation probe is the
   * message input, the same signal `openConversationWith` uses.
   */
  /**
   * Wait until this client believes it is Pro, without provoking a fetch.
   *
   * Reads the Pro row's TITLE, not the badge beside the username. Both come off the same
   * `proDataState`, but the title distinguishes Active from Expired where the badge is merely
   * `!is NeverSubscribed` — so a lapsed subscriber satisfies the badge and not this.
   *
   * Never opens the Pro settings page: that fires `get_pro_status` on mount, which turns a linked
   * device into a second client minting against the same account and races the subscriber's proof.
   */
  /** Read every movable Pro stat (see `IBaseDeviceWrapper`). */
  public async readProStats(): Promise<ProStatCounts> {
    return await readProStats(this);
  }

  public async waitForOwnProBadge(maxWaitMs = 60_000): Promise<void> {
    const alreadyInSettings = await this.doesElementExist({
      ...new PrivacyMenuItem(this).build(),
      maxWait: 5_000,
    });
    if (!alreadyInSettings) {
      const insideConversation = await this.doesElementExist({
        ...new MessageInput(this).build(),
        maxWait: 2_000,
      });
      if (insideConversation) {
        await this.navigateBack();
      }
      await this.clickOnElementAll(new UserSettings(this));
    }
    await assertProFromSettingsRow(this, maxWaitMs);
  }

  public async assertSettingsAvatarAnimated(): Promise<void> {
    const alreadyInSettings = await this.doesElementExist({
      ...new PrivacyMenuItem(this).build(),
      maxWait: 5_000,
    });
    if (!alreadyInSettings) {
      const insideConversation = await this.doesElementExist({
        ...new MessageInput(this).build(),
        maxWait: 2_000,
      });
      if (insideConversation) {
        await this.navigateBack();
      }
      await this.clickOnElementAll(new UserSettings(this));
    }
    await this.verifyElementIsAnimated(new UserAvatar(this), {
      maxWaitMs: AVATAR_SYNC_MAX_WAIT_MS,
    });
    await this.clickOnElementAll(new CloseSettings(this));
  }

  /**
   * Assert the avatar in `convoName`'s conversation header renders animated (see
   * `IBaseDeviceWrapper`).
   *
   * Written in terms of the generic `verifyElementIsAnimated` so the conversation-header locator
   * stays on this side of the interface — a cross-platform spec must not have to name it.
   *
   * The long wait, because everything this reads has to reach the client over the network first — the
   * picture, and the sender's Pro proof deciding whether it may animate. Still bounded, and a caller
   * should wait for one of the peer's messages before calling this, since that is what makes the
   * profile ride along in the first place.
   */
  public async assertConversationHeaderAvatarAnimated(convoName: string): Promise<void> {
    await this.openConversationWith(convoName);
    await this.verifyElementIsAnimated(new ConversationSettings(this), {
      maxWaitMs: AVATAR_SYNC_MAX_WAIT_MS,
    });
  }

  /**
   * Find a message whose body CONTAINS `substring`, addressed by the message-body accessibility id.
   *
   * Exists because `waitForTextElementToBePresent` compares text for exact equality
   * (`findMatchingTextInElementArray`), and the only substring comparison in this class is inside the
   * locator-healing path. Without this the only way to assert on part of a long message was an xpath over
   * `@text`/`@label`/`@name` — a fragile structural locator, where the house rule is an accessibility id
   * plus, where needed, a comparison added HERE rather than a selector that walks the tree.
   *
   * Both `text` and the `label`/`name` attributes are consulted because the two platforms surface a
   * bubble's content differently, and that is exactly the sort of per-platform detail a spec should not
   * have to encode.
   */
  public async findMessageContaining(substring: string): Promise<AppiumNextElementType | null> {
    const { strategy, selector } = new MessageBody(this).build();
    const bodies = await this.findElements(strategy, selector);
    for (const body of bodies) {
      const candidates = [
        await this.getTextFromElement(body).catch(() => ''),
        await this.getAttribute('label', body.ELEMENT).catch(() => ''),
        await this.getAttribute('name', body.ELEMENT).catch(() => ''),
      ];
      if (candidates.some(value => typeof value === 'string' && value.includes(substring))) {
        return body;
      }
    }
    return null;
  }

  /** Poll until a message body contains `substring`, or fail naming what was never found. */
  public async waitForMessageContaining(
    substring: string,
    maxWaitMs = MESSAGE_DELIVERY_TIMEOUT_MS
  ): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    do {
      if (await this.findMessageContaining(substring)) {
        return;
      }
      await sleepFor(1_000);
    } while (Date.now() < deadline);

    throw new Error(
      `No message body containing "${substring}" appeared within ${maxWaitMs}ms. Either it never ` +
        `arrived, or it arrived without that part of its text.`
    );
  }

  /**
   * The receiver-side counterpart of `assertConversationHeaderProBadge`: the sender's badge is gone from here.
   *
   * Both conditions are checked at the SAME instant, and that is the whole design. The header name
   * proves this client is rendering the right conversation, so the absence being asserted is the badge's
   * and not the screen's — otherwise a conversation that failed to open satisfies this, and would go on
   * satisfying it if the client stopped honouring revocations entirely.
   *
   * Polled because the badge disappears when the revocation list arrives, which is a fetch. The failure
   * message distinguishes the two ways this can end, since they have different owners: a header that
   * never rendered is a navigation problem, a badge that never went is the product.
   */
  public async assertNoConversationHeaderProBadge(
    senderName: string,
    anchorMessage?: string
  ): Promise<void> {
    await this.openConversationWith(senderName);

    let headerSeen = false;
    let cleared = false;
    const deadline = Date.now() + 60_000;
    do {
      const header = await this.doesElementExist(
        anchorMessage
          ? { ...new MessageBody(this, anchorMessage).build(), maxWait: 2_000 }
          : { ...new ConversationHeaderName(this, senderName).build(), maxWait: 2_000 }
      );
      if (header) {
        headerSeen = true;
        const badge = await this.doesElementExist({
          ...new ConversationHeaderProBadge(this).build(),
          maxWait: 2_000,
        });
        cleared = !badge;
      }
      if (!cleared) {
        await sleepFor(1_000);
      }
    } while (!cleared && Date.now() < deadline);

    if (!cleared) {
      throw new Error(
        headerSeen
          ? `${senderName}'s Pro badge is still rendered on the conversation header. The proof was ` +
              `revoked, so this client is still honouring a credential it should have rejected — or it ` +
              `never fetched the revocation list (see forceProRevocationRefresh).`
          : `${senderName}'s conversation header never rendered their name, so nothing can be said ` +
              `about the badge. This is a navigation or profile-propagation problem, not a Pro one.`
      );
    }
  }

  /**
   * Open `convoName` and send a >2000-char message, retrying until it is accepted.
   * The text is typed once; each attempt clicks send and, if the "longer messages"
   * CTA blocks it (Pro not active yet on this device), dismisses the CTA and retries
   * within the time budget. Lets us verify Pro synced to a linked device without an
   * app restart.
   */
  public async sendLongProMessage(convoName: string, message: string): Promise<void> {
    await this.openConversationWith(convoName);
    await this.inputText(message, new MessageInput(this));
    const deadline = Date.now() + 60_000;
    do {
      await this.clickOnElementAll(new SendButton(this));
      const sent = await this.doesElementExist({
        ...new MessageBody(this, message).build(),
        maxWait: 5_000,
      });
      if (sent) {
        return;
      }
      // Blocked by the upgrade CTA — Pro hasn't propagated yet. Dismiss and retry;
      // the composed text stays in the input.
      await this.dismissCTA();
      await sleepFor(2_000);
    } while (Date.now() < deadline);
    throw new Error(
      `sendLongProMessage: message never sent on ${this.getDeviceIdentity()} (Pro not active after 60s?)`
    );
  }

  public async getElementPixelColor(
    args: LocatorsInterface | StrategyExtractionObj
  ): Promise<string> {
    // Wait for the element to be present
    const element = await this.waitForTextElementToBePresent(args);
    // Take a screenshot and return a hex color value
    const base64image = await this.getElementScreenshot(element.ELEMENT);
    const pixelColor = await parseDataImage(base64image);
    return pixelColor;
  }

  // Sample an element's centre pixel color SAMPLE_SIZE times to determine whether it is animated or not.
  // If the set contains more than 1 color it is likely animated.
  /**
   * Waits until an avatar stops rendering the generated placeholder, so an animation check that
   * follows is looking at the uploaded picture rather than the fallback.
   *
   * Session draws a flat `avatarBgColors` circle while a picture is absent, loading or failed, and
   * picks the colour by `sha512(address) % 7` — so a placeholder is a *different* palette colour on
   * every run, which is exactly what made this look like a per-build regression rather than a race.
   *
   * Returns the last colour seen so the caller can say what it was still showing when it gave up.
   */
  /**
   * Expand every collapsed message bubble in the open conversation, so an assertion on a long
   * message's full text sees all of it.
   *
   * Best-effort per bubble: a message short enough not to collapse offers no affordance, and the
   * affordance can vanish mid-click as the bubble re-renders.
   *
   * A no-op on iOS, gated here rather than per caller: iOS flattens the bubble into one accessibility
   * element, so `MessageReadMore` throws there and the full text is exposed either way.
   */
  public async expandLongMessages(): Promise<void> {
    if (this.isIOS()) {
      return;
    }

    for (let i = 0; i < 4; i++) {
      const readMore = await this.doesElementExist({
        ...new MessageReadMore(this).build(),
        maxWait: 5_000,
      });
      if (!readMore) {
        return;
      }
      try {
        await this.clickOnElementAll(new MessageReadMore(this));
      } catch {
        // The affordance vanished between the check and the click — the bubble re-renders as it expands,
        // so this races by construction. Best-effort is the contract: what matters is that no collapsed
        // bubble is left hiding the tail, and the assertions that follow say whether one was.
        return;
      }
    }
  }

  private async waitForAvatarToLoad(
    locator: StrategyExtractionObj,
    maxWait = 10_000
  ): Promise<string> {
    const deadline = Date.now() + maxWait;
    let color = await this.getElementPixelColor(locator);

    while (GENERATED_AVATAR_COLORS.has(color.toLowerCase()) && Date.now() < deadline) {
      await sleepFor(500);
      color = await this.getElementPixelColor(locator);
    }
    return color;
  }

  /**
   * Asserts an element's pixels change over time.
   *
   * Retried as a whole rather than sampled once, because a client that did not set the picture itself
   * passes through BOTH failing states on the way to the passing one: first the generated placeholder
   * (nothing has arrived), then the image's own first frame (the picture arrived but the Pro proof
   * that unfreezes it has not yet). Sampling once catches whichever state the client happens to be in
   * and reports it as a product failure — and the frozen one especially, since a frozen avatar is
   * exactly what a real Pro bug looks like.
   *
   * `maxWaitMs` bounds that retry, so raising it costs nothing when the picture is already animating.
   * The default suits a client that set the picture itself and is reading back its own work; anything
   * waiting on config sync or on the network wants `AVATAR_SYNC_MAX_WAIT_MS`, which is what the two
   * named wrappers below pass.
   *
   * The two failing states are still told apart in the message once the deadline passes, because they
   * are different bugs with different owners: a placeholder means the upload never reached this view
   * at all, while a first frame means Pro was false when the avatar was composed
   * (`freezeFrameForUser`).
   */
  public async verifyElementIsAnimated(
    args: LocatorsInterface | StrategyExtractionObj,
    { maxWaitMs = 10_000 }: { maxWaitMs?: number } = {}
  ): Promise<void> {
    const { locator, description } = this.resolveLocator(args);
    this.log(`Checking if ${description} is animated`);

    const SAMPLE_SIZE = 3;
    const deadline = Date.now() + maxWaitMs;
    let colors: Set<string>;
    do {
      colors = new Set<string>();
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        colors.add(await this.getElementPixelColor(locator));
      }
      if (colors.size > 1) {
        return;
      }
      await sleepFor(500);
    } while (Date.now() < deadline);

    const [sampled] = [...colors];
    if (GENERATED_AVATAR_COLORS.has(sampled.toLowerCase())) {
      throw new Error(
        `${description} is still the generated avatar placeholder (${sampled}) — the picture never ` +
          `loaded, so there is nothing to animate. This is an upload/propagation problem, not an ` +
          `animation one; a frozen animated avatar would show the image's own first frame instead.`
      );
    }
    throw new Error(
      `Expected ${description} to be animated but detected 1 unique color: ${sampled}. The image is ` +
        `loaded but static — on an animated avatar that means Pro was false when it was composed ` +
        `(freezeFrameForUser), not that the upload failed.`
    );
  }

  /**
   * Asserts an element's pixels do NOT change over time.
   *
   * The counterpart to `verifyElementIsAnimated`, and asserted the opposite way round: that one can stop
   * the moment it sees a second colour, while a negative has to settle and then require every sample to
   * match. A picture sampled before it renders is a single flat colour and so indistinguishable from a
   * static one, which would pass whatever the client decided.
   *
   * The placeholder check is kept for the same reason it exists there: "the picture never loaded" is a
   * different bug from "the picture loaded and is correctly frozen", and only the second one is what a
   * refusal looks like.
   */
  public async verifyElementIsNotAnimated(
    args: LocatorsInterface | StrategyExtractionObj,
    { settleMs = 10_000, samples = 6 }: { settleMs?: number; samples?: number } = {}
  ): Promise<void> {
    const { locator, description } = this.resolveLocator(args);
    this.log(`Checking if ${description} is static`);

    const loaded = await this.waitForAvatarToLoad(locator);
    if (GENERATED_AVATAR_COLORS.has(loaded.toLowerCase())) {
      throw new Error(
        `${description} is still the generated avatar placeholder (${loaded}) — the picture never ` +
          `loaded, so nothing can be said about whether it animates. This is an upload/propagation ` +
          `problem, not a Pro one.`
      );
    }

    await sleepFor(settleMs);

    const colors = new Set<string>();
    for (let i = 0; i < samples; i++) {
      colors.add(await this.getElementPixelColor(locator));
    }

    if (colors.size > 1) {
      throw new Error(
        `Expected ${description} to be static but detected ${colors.size} unique colours across ` +
          `${samples} samples. The proof carrying the animated-display-picture feature could not be ` +
          `verified, so it should have been refused.`
      );
    }
  }

  public async getVersionNumber() {
    // NOTE if this becomes necessary for more tests, consider adding a property/caching to the DeviceWrapper
    await this.clickOnElementAll(new UserSettings(this));
    await this.onIOS().scrollDown();
    const versionElement = await this.waitForTextElementToBePresent(new VersionNumber(this));
    // Get the full text from the element
    const versionText = await this.getTextFromElement(versionElement);
    // Extract just the version number (e.g. "1.27.0")
    const match = versionText?.match(/(\d+\.\d+\.\d+)/);

    if (!match) {
      throw new Error(`Could not extract version from: ${versionText}`);
    }

    return match[1];
  }

  private getUdid() {
    if (!this.udid) {
      throw new Error('getUdid: stored udid is empty');
    }
    return this.udid;
  }

  /* === all the utilities function ===  */
  public isIOS(): boolean {
    return isDeviceIOS(this.device);
  }

  public isAndroid(): boolean {
    return isDeviceAndroid(this.device);
  }

  private toIOS(): XCUITestDriver {
    if (!this.isIOS()) {
      throw new Error('Not an ios device');
    }
    return this.device as unknown as XCUITestDriver;
  }

  private toAndroid(): AndroidUiautomator2Driver {
    if (!this.isAndroid()) {
      throw new Error('Not an android device');
    }
    return this.device as unknown as AndroidUiautomator2Driver;
  }

  private toShared(): AndroidUiautomator2Driver & XCUITestDriver {
    return this.device as unknown as AndroidUiautomator2Driver & XCUITestDriver;
  }
}
