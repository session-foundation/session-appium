import { getImageOccurrence } from '@appium/opencv';
import { TestInfo } from '@playwright/test';
import { W3CCapabilities } from '@wdio/types/build/Capabilities';
import { AndroidUiautomator2Driver } from 'appium-uiautomator2-driver';
import { XCUITestDriver } from 'appium-xcuitest-driver/build/lib/driver';
import fs from 'fs/promises';
import Fuse from 'fuse.js';
import { isArray, isEmpty } from 'lodash';
import * as path from 'path';
import sharp from 'sharp';
import * as sinon from 'sinon';

import {
  ChangeProfilePictureButton,
  CloseSettings,
  describeLocator,
  DownloadMediaButton,
  FirstGif,
  ImageName,
  ImagePermissionsModalAllow,
  LocatorsInterface,
  ReadReceiptsButton,
} from '../../run/test/specs/locators';
import {
  profilePicture,
  testFile,
  testImage,
  testVideo,
  testVideoThumbnail,
} from '../constants/testfiles';
import { englishStrippedStr } from '../localizer/englishStrippedStr';
import {
  AttachmentsButton,
  DocumentsFolderButton,
  GIFButton,
  ImagesFolderButton,
  MessageBody,
  MessageInput,
  NewVoiceMessageButton,
  OutgoingMessageStatusSent,
  ScrollToBottomButton,
  SendButton,
} from '../test/specs/locators/conversation';
import {
  Contact,
  CTABody,
  CTAButtonNegative,
  CTAButtonPositive,
  CTAFeature,
  CTAHeading,
  ModalDescription,
  ModalHeading,
} from '../test/specs/locators/global';
import { ConversationItem, PlusButton } from '../test/specs/locators/home';
import { LoadingAnimation } from '../test/specs/locators/onboarding';
import {
  PrivacyMenuItem,
  SaveProfilePictureButton,
  UserAvatar,
  UserSettings,
  VersionNumber,
} from '../test/specs/locators/settings';
import {
  EnterAccountID,
  NewMessageOption,
  NextButton,
} from '../test/specs/locators/start_conversation';
import { clickOnCoordinates, sleepFor } from '../test/specs/utils';
import { getAdbFullPath } from '../test/specs/utils/binaries';
import { parseDataImage } from '../test/specs/utils/check_colour';
import { isSameColor } from '../test/specs/utils/check_colour';
import { SupportedPlatformsType } from '../test/specs/utils/open_app';
import { isDeviceAndroid, isDeviceIOS, runScriptAndLog } from '../test/specs/utils/utilities';
import {
  AccessibilityId,
  DISAPPEARING_TIMES,
  Group,
  Id,
  InteractionPoints,
  Strategy,
  StrategyExtractionObj,
  User,
  XPath,
} from './testing';

export type Coordinates = {
  x: number;
  y: number;
};
export type ActionSequence = {
  actions: string;
};

type AppiumNextElementType = { ELEMENT: string };

type PollResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

export class DeviceWrapper {
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
  public async doubleClick(elementId: string): Promise<void> {
    return this.toShared().mobileDoubleTap(elementId);
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

  public async getDeviceTime(platform: SupportedPlatformsType): Promise<string> {
    return this.toShared().getDeviceTime(platform);
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

  public async tap(xCoOrdinates: number, yCoOrdinates: number): Promise<void> {
    if (this.isIOS()) {
      await this.toIOS().mobileTap(xCoOrdinates, yCoOrdinates);
      return;
    }
    if (this.isAndroid()) {
      await this.toAndroid().mobileClickGesture({ x: xCoOrdinates, y: yCoOrdinates });
      return;
    }
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

  public async performActions(actions: ActionSequence): Promise<void> {
    await this.toShared().performActions([actions]);
  }

  public async pushFile(path: string, data: string): Promise<void> {
    this.log('Did file get pushed', path);
    await this.toShared().pushFile(path, data);
  }

  public async getElementScreenshot(elementId: string): Promise<string> {
    return this.toShared().getElementScreenshot(elementId);
  }

  public async getScreenshot(): Promise<string> {
    return this.toShared().getScreenshot();
  }

  public async getViewportScreenshot(): Promise<string> {
    return this.toShared().getViewportScreenshot();
  }

  public async getWindowRect(): Promise<{ height: number; width: number; x: number; y: number }> {
    return this.toShared().getWindowRect();
  }

  // Session management
  public async createSession(caps: W3CCapabilities): Promise<[string, Record<string, any>]> {
    const createSession: string = await this.toShared().createSession(caps);
    return [createSession, caps];
  }

  public async deleteSession(): Promise<void> {
    return this.toShared().deleteSession();
  }

  public async getPageSource(): Promise<string> {
    return this.toShared().getPageSource();
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
    const threshold = 0.35; // 0.0 = exact, 1.0 = match anything

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
      let isValidCandidate = true;

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
    const primary =
      primaryLocator instanceof LocatorsInterface ? primaryLocator.build() : primaryLocator;
    const fallback =
      fallbackLocator instanceof LocatorsInterface ? fallbackLocator.build() : fallbackLocator;

    const primaryDescription = describeLocator(primary);
    const fallbackDescription = describeLocator(fallback);

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
        throw new Error(`Element ${primaryDescription} and ${fallbackDescription} not found.`);
      }
    }
  }

  public async longClick(element: AppiumNextElementType, durationMs: number) {
    if (this.isIOS()) {
      // iOS takes a number in seconds
      const duration = Math.floor(durationMs / 1000);
      return this.toIOS().mobileTouchAndHold(duration, undefined, undefined, element.ELEMENT);
    }
    return this.toAndroid().mobileLongClickGesture({
      elementId: element.ELEMENT,
      duration: durationMs,
    });
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
    let el: AppiumNextElementType | null = null;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    el = await this.waitForTextElementToBePresent({ ...locator });
    await this.click(el.ELEMENT);
    return el;
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

  public async clickOnElementXPath(xpath: XPath, maxWait?: number) {
    await this.waitForTextElementToBePresent({
      strategy: 'xpath',
      selector: xpath,
      maxWait: maxWait,
    });
    const el = await this.findElementByXPath(xpath);

    await this.click(el.ELEMENT);
  }

  public async clickOnElementById(id: Id) {
    await this.waitForTextElementToBePresent({ strategy: 'id', selector: id });
    const el = await this.findElement('id', id);
    await this.click(el.ELEMENT);
  }

  public async clickOnTextElementById(id: Id, text: string) {
    const el = await this.findTextElementArrayById(id, text);
    await this.waitForTextElementToBePresent({
      strategy: 'id',
      selector: id,
      text,
    });

    await this.click(el.ELEMENT);
  }

  public async clickOnCoordinates(xCoOrdinates: number, yCoOrdinates: number) {
    await this.pressCoordinates(xCoOrdinates, yCoOrdinates);
    this.log(`Tapped coordinates ${xCoOrdinates}, ${yCoOrdinates}`);
  }

  public async tapOnElement(accessibilityId: AccessibilityId) {
    const el = await this.findElementByAccessibilityId(accessibilityId);
    if (!el) {
      throw new Error(`Tap: Couldnt find accessibilityId: ${accessibilityId}`);
    }
    await this.click(el.ELEMENT);
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
    args: { text?: string; maxWait?: number } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<void> {
    const { text, maxWait = 10_000 } = args;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    // Merge text if provided
    const finalLocator = text ? { ...locator, text } : locator;

    const displayText = describeLocator(finalLocator);
    this.log(`Attempting long press on ${displayText}`);

    await this.pollUntil(
      async () => {
        // Find the message
        this.log(`Looking for: ${JSON.stringify(finalLocator)}`);
        const el = await this.waitForTextElementToBePresent({
          ...finalLocator,
          maxWait: 1_000,
        });

        if (!el) {
          return { success: false, error: `Message not found: ${displayText}` };
        }

        // Attempt long click
        await this.longClick(el, 2000);

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
          error: `Long press didn't show context menu for ${displayText}`,
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
        await sleepFor(1000);
        // Pin is the only consistent option in context menu
        const longPressSuccess = await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Pin',
          maxWait: 1000,
        });

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

  public async pressAndHold(accessibilityId: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: accessibilityId,
    });
    await this.longClick(el, 2000);
  }

  public async selectByText(accessibilityId: AccessibilityId, text: string) {
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: accessibilityId,
      text,
    });
    const selector = await this.findMatchingTextAndAccessibilityId(accessibilityId, text);
    await this.click(selector.ELEMENT);

    return text;
  }

  public async getTextFromElement(element: AppiumNextElementType): Promise<string> {
    const text = await this.getText(element.ELEMENT);

    return text;
  }

  public async grabTextFromAccessibilityId(accessibilityId: AccessibilityId): Promise<string> {
    const elementId = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: accessibilityId,
    });
    const text = await this.getTextFromElement(elementId);
    return text;
  }

  public async deleteText(
    args: LocatorsInterface | ({ text?: string; maxWait?: number } & StrategyExtractionObj)
  ) {
    let el: AppiumNextElementType | null = null;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    el = await this.waitForTextElementToBePresent({ ...locator });
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

  public async findElementByClass(androidClassName: string): Promise<AppiumNextElementType> {
    const element = await this.findElement('class name', androidClassName);
    if (!element) {
      throw new Error(`findElementByClass: Did not find classname: ${androidClassName}`);
    }
    return element;
  }

  public async findElementsByClass(
    androidClassName: string
  ): Promise<Array<AppiumNextElementType>> {
    const elements = await this.findElements('class name', androidClassName);
    if (!elements) {
      throw new Error(`findElementsByClass: Did not find classname: ${androidClassName}`);
    }

    return elements;
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

  public async findMatchingTextInElementArray(
    elements: Array<AppiumNextElementType>,
    textToLookFor: string
  ): Promise<AppiumNextElementType | null> {
    if (elements && elements.length) {
      const matching = await this.findAsync(elements, async e => {
        const text = await this.getTextFromElement(e);
        const isPartialMatch = text && text.toLowerCase().includes(textToLookFor.toLowerCase());
        return Boolean(isPartialMatch);
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

  public async findLastElementInArray(
    accessibilityId: AccessibilityId
  ): Promise<AppiumNextElementType> {
    const elements = await this.findElementsByAccessibilityId(accessibilityId);

    const [lastElement] = elements.slice(-1);

    if (!elements) {
      throw new Error(`No elements found with ${accessibilityId}`);
    }

    return lastElement;
  }

  public async findMessageWithBody(textToLookFor: string): Promise<AppiumNextElementType> {
    await this.waitForTextElementToBePresent(new MessageBody(this, textToLookFor));
    const message = await this.findMatchingTextAndAccessibilityId('Message body', textToLookFor);
    return message;
  }
  /**
   * Attempts to visually match a reference image against all elements found by the given locator,
   * and taps the best match (or the first high-confidence match if earlyMatch is enabled).
   * This is useful for scenarios where UI elements cannot be reliably identified,
   * such as elements with date-based accessibility IDs.
   *
   * @param locator - The strategy and selector to find candidate elements.
   * @param referenceImageName - The filename of the reference image (in the media directory).
   * @param earlyMatch - If true, taps immediately on the first match above the earlyMatchThreshold.
   * @throws If no suitable match is found among the candidate elements.
   */
  public async matchAndTapImage(
    locator: StrategyExtractionObj,
    referenceImageName: string,
    earlyMatch: boolean = true
  ): Promise<void> {
    const threshold = 0.85;
    const earlyMatchThreshold = 0.97;

    // Find all candidate elements matching the locator
    const elements = await this.findElements(locator.strategy, locator.selector);
    this.info(
      `[matchAndTapImage] Starting image matching: ${elements.length} elements with ${locator.strategy} "${locator.selector}"`
    );

    // Load the reference image buffer from disk
    const referencePath = path.join('run', 'test', 'specs', 'media', referenceImageName);
    const referenceBuffer = await fs.readFile(referencePath);

    let bestMatch: {
      center: { x: number; y: number };
      score: number;
    } | null = null;

    // Iterate over each candidate element
    for (const el of elements) {
      // Take a screenshot of the element
      const base64 = await this.getElementScreenshot(el.ELEMENT);
      const elementBuffer = Buffer.from(base64, 'base64');

      // Get the element's rectangle (position and size)
      const rect = await this.getElementRect(el.ELEMENT);
      if (!rect) {
        continue;
      }
      // Get actual pixel dimensions of the element screenshot
      const elementMeta = await sharp(elementBuffer).metadata();
      // Get original reference image dimensions
      const refMeta = await sharp(referenceBuffer).metadata();

      let resizedRef: Buffer;

      if (elementMeta.width === refMeta.width && elementMeta.height === refMeta.height) {
        // Skip resizing if reference already matches the screenshot dimensions
        resizedRef = referenceBuffer;
      } else {
        // Resize the reference image to exactly match the screenshot dimensions
        const targetWidth = elementMeta.width;
        const targetHeight = elementMeta.height;

        resizedRef = await sharp(referenceBuffer).resize(targetWidth, targetHeight).toBuffer();
      }

      try {
        const { rect: matchRect, score } = await getImageOccurrence(elementBuffer, resizedRef, {
          threshold,
        });

        /**
         * Matching is done on a resized reference image to account for device pixel density.
         * However, the coordinates returned by getImageOccurrence are relative to the resized buffer,
         * *not* the original screen element. This leads to incorrect tap positions unless we
         * scale the match result back down to the actual dimensions of the element.
         * The logic below handles this scaling correction, ensuring the tap lands at the correct
         * screen coordinates — even when Retina displays and image resizing are involved.
         */

        // Calculate scale between resized image and element dimensions
        const resizedMeta = await sharp(resizedRef).metadata();
        const scaleX = rect.width / (resizedMeta.width ?? rect.width);
        const scaleY = rect.height / (resizedMeta.height ?? rect.height);

        // Calculate center of the match rectangle (in buffer space)
        const matchCenterX = matchRect.x + Math.floor(matchRect.width / 2);
        const matchCenterY = matchRect.y + Math.floor(matchRect.height / 2);

        // Scale match center down to element space
        const scaledCenterX = matchCenterX * scaleX;
        const scaledCenterY = matchCenterY * scaleY;

        // Final absolute coordinates
        const tapX = Math.round(rect.x + scaledCenterX);
        const tapY = Math.round(rect.y + scaledCenterY);

        const center = { x: tapX, y: tapY };

        // If earlyMatch is enabled and the score is high enough, tap immediately
        if (earlyMatch && score >= earlyMatchThreshold) {
          this.info(
            `[matchAndTapImage] Tapping first high-confidence match (${(score * 100).toFixed(2)}%)`
          );
          await clickOnCoordinates(this, center);
          return;
        }
        // Otherwise, keep track of the best match so far
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { center, score };
        }
      } catch {
        continue; // No match in this element, try next
      }
    }
    // If no good match was found, throw an error
    if (!bestMatch) {
      console.log(
        `[matchAndTapImage] No matching image found among ${elements.length} elements for ${locator.strategy} "${locator.selector}"`
      );
      throw new Error('Unable to find the expected UI element on screen');
    }
    // Tap the best match found
    this.info(
      `[matchAndTapImage] Tapping best match with ${(bestMatch.score * 100).toFixed(2)}% confidence`
    );
    await clickOnCoordinates(this, bestMatch.center);
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
    const locator = args instanceof LocatorsInterface ? args.build() : args;
    const maxWait = args.maxWait || 2_000;

    // Wait for any transitions to complete
    await sleepFor(maxWait);

    const element = await this.findElementQuietly(locator, args.text);

    const description = describeLocator({ ...locator, text: args.text });

    if (element) {
      // Elements can disappear in the GUI but still be present in the DOM
      try {
        const isVisible = await this.isVisible(element.ELEMENT);
        if (isVisible) {
          throw new Error(
            `Element with ${description} is visible after ${maxWait}ms when it should not be`
          );
        }
        // Element exists but not visible - that's okay
        this.log(`Element with ${description} exists but is not visible`);
      } catch (e) {
        // Stale element or other error - element is gone, that's okay
        this.log(`Element with ${description} is not present (stale reference)`);
      }
    } else {
      this.log(`Verified no element with ${description} is present`);
    }
  }

  /**
   * Waits for an element to be deleted from the screen. The element must exist initially.
   *
   * @param args - Locator (LocatorsInterface or StrategyExtractionObj) with optional properties
   * @param args.text - Optional text content to match within elements of the same type
   * @param args.initialMaxWait - Time to wait for element to initially appear (defaults to 10_000ms)
   * @param args.maxWait - Time to wait for deletion AFTER element is found (defaults to 30_000ms)
   *
   * @throws Error if:
   * - The element is never found within initialMaxWait
   * - The element still exists after maxWait
   */
  public async hasElementBeenDeleted(
    args: {
      text?: string;
      initialMaxWait?: number;
      maxWait?: number;
    } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<void> {
    const locator = args instanceof LocatorsInterface ? args.build() : args;
    const text = args.text;
    const initialMaxWait = args.initialMaxWait ?? 10_000;
    const maxWait = args.maxWait ?? 30_000;

    const description = describeLocator({ ...locator, text: args.text });

    // Track total time from start - disappearing timers begin on send, not on display
    const functionStartTime = Date.now();
    // Phase 1: Wait for element to appear
    this.log(`Waiting for element with ${description} to be deleted...`);
    await this.waitForElementToAppear(locator, initialMaxWait, text);
    this.log(`Element with ${description} has been found, now waiting for deletion`);

    // Phase 2: Wait for element to disappear
    await this.waitForElementToDisappear(locator, maxWait, text);

    // Always calculate total time for logging
    const totalTime = (Date.now() - functionStartTime) / 1000;

    this.log(
      `Element with ${description} has been deleted after ${totalTime.toFixed(1)}s total time`
    );
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
    } & (LocatorsInterface | StrategyExtractionObj)
  ): Promise<void> {
    const locator = args instanceof LocatorsInterface ? args.build() : args;
    const text = args.text;
    const initialMaxWait = args.initialMaxWait ?? 10_000;
    const maxWait = args.maxWait ?? 30_000;

    const description = describeLocator({ ...locator, text: args.text });

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
    const expectedTotalTime = maxWait / 1000;
    const minAcceptableTotalTimeFactor = 0.65; // Catches egregiously early deletions but still enough leeway for sending/trusting/receiving
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
    args: { text?: string; maxWait?: number; skipHealing?: boolean } & (
      | LocatorsInterface
      | StrategyExtractionObj
    )
  ): Promise<AppiumNextElementType> {
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    // Prefer text from args (if passed directly), otherwise check locator
    const text = args.text ?? ('text' in locator ? locator.text : undefined);

    const { maxWait = 30_000 } = args;
    const skipHealing = 'skipHealing' in args ? (args.skipHealing ?? false) : false;

    const description = describeLocator({ ...locator, text });
    this.log(`Waiting for element with ${description} to be present`);

    // Helper function to find element with or without healing
    const tryFindElement = async (allowHealing: boolean): Promise<AppiumNextElementType | null> => {
      try {
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
      // Healing failed, re-throw original error
      throw originalError;
    });
    // Element was found as-is
    this.log(`Element with ${description} has been found`);
    return result!; // Result must exist if we reached this point
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
      { maxWait: 15_000 }
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
    let elapsed = 0;
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
    const locator = args instanceof LocatorsInterface ? args.build() : args;
    const description = describeLocator({ ...locator, text: args.text });

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

  public async sendMessage(message: string): Promise<number> {
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
    const sentTimestamp = Date.now();
    return sentTimestamp;
  }

  public async sendNewMessage(user: Pick<User, 'accountID'>, message: string) {
    // Sender workflow
    // Click on plus button
    await this.clickOnElementAll(new PlusButton(this));
    // Select direct message option
    await this.clickOnElementAll(new NewMessageOption(this));
    // Enter User B's session ID into input box
    await this.inputText(user.accountID, new EnterAccountID(this));
    // Click next
    await this.scrollDown();
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

  public async sendMessageTo(sender: User, receiver: Group | User) {
    const message = `${sender.userName} to ${receiver.userName}`;
    await this.clickOnElementAll(new ConversationItem(this, receiver.userName));
    this.log(`${sender.userName} + " sent message to ${receiver.userName}`);
    await this.sendMessage(message);
    this.log(`Message received by ${receiver.userName} from ${sender.userName}`);
    return message;
  }
  // TODO instead of blind sleeping, check presence of reply preview
  // Remove blind sleep from other tests that reply as well
  public async replyToMessage(user: Pick<User, 'userName'>, body: string) {
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
    args: LocatorsInterface | ({ maxWait?: number } & StrategyExtractionObj)
  ) {
    let el: AppiumNextElementType | null = null;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    this.log('Locator being used:', locator);

    el = await this.waitForTextElementToBePresent({ ...locator });
    if (!el) {
      throw new Error(`inputText: Did not find element with locator: ${JSON.stringify(locator)}`);
    }

    await this.setValueImmediate(textToInput, el.ELEMENT);
  }

  public async getAttribute(attribute: string, elementId: string) {
    return this.toShared().getAttribute(attribute, elementId);
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
    mediaFileName: 'profile_picture.jpg' | 'test_file.pdf' | 'test_image.jpg' | 'test_video.mp4'
  ) {
    const filePath = path.join('run', 'test', 'specs', 'media', mediaFileName);
    if (this.isIOS()) {
      // Push file to simulator
      await runScriptAndLog(`xcrun simctl addmedia ${this.udid} ${filePath}`, true);
    } else if (this.isAndroid()) {
      const ANDROID_DOWNLOAD_DIR = '/storage/emulated/0/Download';
      // Clear downloads folder at runtime before pushing
      await runScriptAndLog(
        `${getAdbFullPath()} -s ${this.udid} shell rm -rf ${ANDROID_DOWNLOAD_DIR}/*`,
        true
      );
      // Push file
      await runScriptAndLog(
        `${getAdbFullPath()} -s ${this.udid} push ${filePath} ${ANDROID_DOWNLOAD_DIR}`,
        true
      );
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
      await sleepFor(1000);
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      await sleepFor(2000); // Appium needs a moment, matchAndTapImage sometimes finds 0 elements otherwise
      await this.matchAndTapImage(
        { strategy: 'xpath', selector: `//XCUIElementTypeCell` },
        testImage
      );
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
        selector: 'network.loki.messenger:id/mediapicker_folder_item_thumbnail',
      });
      await sleepFor(100);
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'network.loki.messenger:id/mediapicker_image_item_thumbnail',
      });
    }
    await this.inputText(message, new MessageInput(this));
    await this.clickOnElementAll(new SendButton(this));
    if (community) {
      await this.scrollToBottom();
    }
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    const sentTimestamp = Date.now();
    return sentTimestamp;
  }
  public async sendVideoiOS(message: string): Promise<number> {
    // iOS files are pre-loaded on simulator creation, no need to push
    await this.clickOnElementAll(new AttachmentsButton(this));
    await this.clickOnElementAll(new ImagesFolderButton(this));
    await sleepFor(100);
    await this.modalPopup({
      strategy: 'accessibility id',
      selector: 'Allow Full Access',
    });
    await sleepFor(2000); // Appium needs a moment, matchAndTapImage sometimes finds 0 elements otherwise
    // A video can't be matched by its thumbnail so we use a video thumbnail file
    await this.matchAndTapImage(
      { strategy: 'xpath', selector: `//XCUIElementTypeCell` },
      testVideoThumbnail
    );
    await this.sendMessage(message);
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    const sentTimestamp = Date.now();
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
    await sleepFor(2000);
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
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    const sentTimestamp = Date.now();
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
      await sleepFor(1000);
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
    await this.checkModalStrings(
      englishStrippedStr('giphyWarning').toString(),
      englishStrippedStr('giphyWarningDescription').toString()
    );
    await this.clickOnByAccessibilityID('Continue', 5000);
    await this.clickOnElementAll(new FirstGif(this));
    if (this.isIOS()) {
      await this.clickOnElementAll(new SendButton(this));
    }
    // Checking Sent status on both platforms
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    const sentTimestamp = Date.now();
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
    // Checking Sent status on both platforms
    await this.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(this).build(),
      maxWait: 20000,
    });
    const sentTimestamp = Date.now();
    return sentTimestamp;
  }

  public async uploadProfilePicture() {
    await this.clickOnElementAll(new UserSettings(this));
    // Click on Profile picture
    await this.clickOnElementAll(new UserAvatar(this));
    await this.clickOnElementAll(new ChangeProfilePictureButton(this));
    // iOS files are pre-loaded on simulator creation, no need to push
    if (this.isIOS()) {
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      await sleepFor(5000); // sometimes Appium doesn't recognize the XPATH immediately
      await this.matchAndTapImage(
        { strategy: 'xpath', selector: `//XCUIElementTypeImage` },
        profilePicture
      );
      await this.clickOnByAccessibilityID('Done');
    } else if (this.isAndroid()) {
      // Push file first
      await this.pushMediaToDevice(profilePicture);
      await this.clickOnElementAll(new ImagePermissionsModalAllow(this));
      await sleepFor(1000);
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'Image button',
      });
      await sleepFor(500);
      await this.clickOnElementAll(new ImageName(this));
      await this.clickOnElementById('network.loki.messenger:id/crop_image_menu_crop');
    }
    await this.clickOnElementAll(new SaveProfilePictureButton(this));
  }

  public async getTimeFromDevice(platform: SupportedPlatformsType): Promise<string> {
    let timeString = '';
    try {
      const time = await this.getDeviceTime(platform);
      timeString = time.toString();
      this.log(`Device time: ${timeString}`);
    } catch (e) {
      this.log(`Couldn't get time from device`);
    }
    return timeString;
  }

  public async isKeyboardVisible() {
    if (this.isIOS()) {
      const spaceBar = await this.doesElementExist({
        strategy: 'accessibility id',
        selector: 'space',
        maxWait: 500,
      });
      return Boolean(spaceBar);
    }
    this.log(`Not an iOS device: shouldn't use this function`);
  }

  public async mentionContact(platform: SupportedPlatformsType, contact: Pick<User, 'userName'>) {
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
      await sleepFor(2000);
    }

    await this.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Untrusted attachment message',
    });
    await this.checkModalStrings(
      englishStrippedStr(`attachmentsAutoDownloadModalTitle`).toString(),
      englishStrippedStr(`attachmentsAutoDownloadModalDescription`)
        .withArgs({ conversation_name: conversationName })
        .toString()
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
  public async swipeRightAny(selector: AccessibilityId) {
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
      { x: loc.x + loc.width * 2, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width * 8, y: loc.y + loc.height / 2 },
      500
    );

    this.info('Swiped right on ', selector);
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

  public async scrollDown() {
    await this.scroll({ x: 760, y: 1500 }, { x: 760, y: 710 }, 100);
  }

  public async scrollUp() {
    await this.scroll({ x: 760, y: 710 }, { x: 760, y: 1500 }, 100);
  }

  public async swipeFromBottom(): Promise<void> {
    const { width, height } = await this.getWindowRect();

    await this.scroll({ x: width / 2, y: height * 0.95 }, { x: width / 2, y: height * 0.35 }, 100);
  }

  public async scrollToBottom() {
    if (
      await this.doesElementExist({ ...new ScrollToBottomButton(this).build(), maxWait: 3_000 })
    ) {
      await this.clickOnElementAll(new ScrollToBottomButton(this));
    } else {
      this.info('Scroll button not found, continuing');
    }
  }
  public async pullToRefresh(): Promise<void> {
    const { width, height } = await this.getWindowRect();
    await this.scroll({ x: width / 2, y: height * 0.15 }, { x: width / 2, y: height * 0.55 }, 200);
  }

  public async navigateBack(newAndroid: boolean = true) {
    if (this.isIOS()) {
      await this.clickOnByAccessibilityID('Back');
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
    await sleepFor(100);
    await this.clickOnElementAll(new UserSettings(this));
    await sleepFor(500);
    await this.clickOnElementAll(new PrivacyMenuItem(this));
    await sleepFor(2000);
    await this.clickOnElementAll(new ReadReceiptsButton(this));
    await this.navigateBack(false);
    await sleepFor(100);
    await this.clickOnElementAll(new CloseSettings(this));
  }

  public async processPermissions(locator: LocatorsInterface) {
    const locatorConfig = locator.build();

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
        // Execute the action in the home screen context
        const iosPermissions = await this.doesElementExist({
          ...locatorConfig,
          maxWait: 2_000,
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
      const iosPermissions = await this.doesElementExist({
        ...args,
        maxWait: 3_000,
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
  private sanitizeString(input: string): string {
    // Handle space + newlines as a unit
    return input.replace(/\s*\n+/g, ' ').trim();
  }

  /**
   * Asserts that actual text matches expected text.
   * @throws Error with detailed message if texts don't match
   */
  private assertTextMatches(actual: string, expected: string, fieldName: string): void {
    const sanitizedActual = this.sanitizeString(actual);
    const sanitizedExpected = this.sanitizeString(expected);

    if (sanitizedExpected === sanitizedActual) {
      this.log(`${fieldName} is correct`);
    } else {
      throw new Error(
        `${fieldName} is incorrect.\nExpected: ${sanitizedExpected}\nActual: ${sanitizedActual}`
      );
    }
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

  /**
   * Checks CTA component text against expected values.
   * CTAs contain: heading, body, 0-3 features, 1-2 buttons.
   * @param heading - Expected CTA heading text
   * @param body - Expected CTA body text
   * @param buttons - Expected button text(s). First is positive, second (if present) is negative
   * @param features - Optional array of expected feature text (0-3 items)
   * @throws Error if any text element doesn't match expected value
   */
  public async checkCTAStrings(
    heading: string,
    body: string,
    buttons: string[],
    features?: string[]
  ): Promise<void> {
    // Validate input
    if (features && features.length > 3) {
      throw new Error('CTAs support maximum 3 features');
    }
    if (buttons.length < 1 || buttons.length > 2) {
      throw new Error('CTAs must have 1-2 buttons');
    }

    // Find and check heading
    const elHeading = await this.waitForTextElementToBePresent(new CTAHeading(this));
    const actualHeading = await this.getTextFromElement(elHeading);
    this.log(actualHeading);
    this.assertTextMatches(actualHeading, heading, 'CTA heading');

    // Find and check body
    const elBody = await this.waitForTextElementToBePresent(new CTABody(this));
    const actualBody = await this.getTextFromElement(elBody);
    this.assertTextMatches(actualBody, body, 'CTA body');

    // Check features if expected
    if (features && features.length > 0) {
      for (let i = 0; i < features.length; i++) {
        const featureLocator = new CTAFeature(this, i + 1);
        const elFeature = await this.waitForTextElementToBePresent(featureLocator);
        const actualFeature = await this.getTextFromElement(elFeature);
        this.assertTextMatches(actualFeature, features[i], `CTA feature ${i + 1}`);
      }
    }

    // Check buttons
    const positiveLocator = new CTAButtonPositive(this);
    const elPositive = await this.waitForTextElementToBePresent(positiveLocator);
    const actualPositive = await this.getTextFromElement(elPositive);
    this.assertTextMatches(actualPositive, buttons[0], 'CTA positive button');

    if (buttons.length === 2) {
      const negativeLocator = new CTAButtonNegative(this);
      const elNegative = await this.waitForTextElementToBePresent(negativeLocator);
      const actualNegative = await this.getTextFromElement(elNegative);
      this.assertTextMatches(actualNegative, buttons[1], 'CTA negative button');
    }
  }

  public async getElementPixelColor(args: LocatorsInterface): Promise<string> {
    // Wait for the element to be present
    const element = await this.waitForTextElementToBePresent(args);
    // Take a screenshot and return a hex color value
    const base64image = await this.getElementScreenshot(element.ELEMENT);
    const pixelColor = await parseDataImage(base64image);
    return pixelColor;
  }

  public async getVersionNumber() {
    // NOTE if this becomes necessary for more tests, consider adding a property/caching to the DeviceWrapper
    await this.clickOnElementAll(new UserSettings(this));
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
