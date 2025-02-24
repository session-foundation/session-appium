import { W3CCapabilities } from '@wdio/types/build/Capabilities';
import { AndroidUiautomator2Driver } from 'appium-uiautomator2-driver';
import { XCUITestDriver } from 'appium-xcuitest-driver/build/lib/driver';
import { isArray, isEmpty } from 'lodash';
import * as sinon from 'sinon';
import {
  ChangeProfilePictureButton,
  ExitUserProfile,
  FirstGif,
  ImagePermissionsModalAllow,
  LocatorsInterface,
  PrivacyButton,
  ReadReceiptsButton,
  SendMediaButton,
} from '../../run/test/specs/locators';
import { IOS_XPATHS } from '../constants';
import { ModalDescription, ModalHeading } from '../test/specs/locators/global';
import { SaveProfilePictureButton, UserSettings } from '../test/specs/locators/settings';
import { clickOnCoordinates, sleepFor } from '../test/specs/utils';
import { getAdbFullPath } from '../test/specs/utils/binaries';
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
import { parseDataImage } from '../test/specs/utils/check_colour';

export type Coordinates = {
  x: number;
  y: number;
};
export type ActionSequence = {
  actions: string;
};

type AppiumNextElementType = { ELEMENT: string };

export class DeviceWrapper {
  private readonly device: AndroidUiautomator2Driver | XCUITestDriver;
  public readonly udid: string;

  constructor(device: AndroidUiautomator2Driver | XCUITestDriver, udid: string) {
    this.device = device;
    this.udid = udid;
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
  ): Promise<undefined | { height: number; width: number; x: number; y: number }> {
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

  public async pressCoordinates(xCoOrdinates: number, yCoOrdinates: number): Promise<void> {
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
          { type: 'pause', duration: 200 },

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
      await runScriptAndLog(`${getAdbFullPath()} -s emulator-5554 shell input keyevent 3`, true);
      return;
    }
  }

  public async performActions(actions: ActionSequence): Promise<void> {
    await this.toShared().performActions([actions]);
  }

  public async pushFile(path: string, data: string): Promise<void> {
    console.log('Did file get pushed', path);
    await this.toShared().pushFile(path, data);
  }

  public async getElementScreenshot(elementId: string): Promise<string> {
    return this.toShared().getElementScreenshot(elementId);
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

  public async findElement(strategy: Strategy, selector: string): Promise<AppiumNextElementType> {
    return this.toShared().findElement(strategy, selector) as Promise<AppiumNextElementType>;
  }

  public async findElements(
    strategy: Strategy,
    selector: string
  ): Promise<Array<AppiumNextElementType>> {
    return this.toShared().findElements(strategy, selector) as Promise<
      Array<AppiumNextElementType>
    >;
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
        console.log('Element is stale, refinding element and attempting second click');
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
    args: { text?: string; maxWait?: number } & (StrategyExtractionObj | LocatorsInterface)
  ) {
    let el: null | AppiumNextElementType = null;
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
    console.log(`Tapped coordinates ${xCoOrdinates}, ${yCoOrdinates}`);
  }

  public async tapOnElement(accessibilityId: AccessibilityId) {
    const el = await this.findElementByAccessibilityId(accessibilityId);
    if (!el) {
      throw new Error(`Tap: Couldnt find accessibilityId: ${accessibilityId}`);
    }
    await this.click(el.ELEMENT);
  }
  // TODO update this function to handle new locator logic
  public async longPress(accessibilityId: AccessibilityId, text?: string) {
    const el = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: accessibilityId,
      text,
    });
    if (!el) {
      throw new Error(`longPress: Could not find accessibilityId: ${accessibilityId}`);
    }
    await this.longClick(el, 2000);
  }

  public async longPressMessage(textToLookFor: string) {
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      try {
        const el = await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Message body',
          text: textToLookFor,
          maxWait: 1000,
        });

        if (!el) {
          throw new Error(
            `longPress on message: ${textToLookFor} unsuccessful, couldn't find message`
          );
        }

        await this.longClick(el, 3000);
        const longPressSuccess = await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Reply to message',
          maxWait: 1000,
        });

        if (longPressSuccess) {
          console.log('LongClick successful');
          success = true; // Exit the loop if successful
        } else {
          throw new Error(`longPress on message: ${textToLookFor} unsuccessful`);
        }
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error(
            `Longpress on message: ${textToLookFor} unsuccessful after ${maxRetries} attempts, ${(error as Error).toString()}`
          );
        }
        console.log(`Longpress attempt ${attempt} failed. Retrying...`);
        await sleepFor(1000);
      }
    }
  }

  public async longPressConversation(userName: string) {
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      try {
        const el = await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Conversation list item',
          text: userName,
        });

        if (!el) {
          throw new Error(
            `longPress on conversation list: ${userName} unsuccessful, couldn't find conversation`
          );
        }

        await this.longClick(el, 3000);
        await sleepFor(1000);
        const longPressSuccess = await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Details',
          maxWait: 1000,
        });

        if (longPressSuccess) {
          console.log('LongClick successful');
          success = true; // Exit the loop if successful
        } else {
          throw new Error(`longPress on conversation list: ${userName} unsuccessful`);
        }
      } catch (error) {
        console.log(`Longpress attempt ${attempt} failed. Retrying...`);
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
    args: ({ text?: string; maxWait?: number } & StrategyExtractionObj) | LocatorsInterface
  ) {
    let el: null | AppiumNextElementType = null;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    el = await this.waitForTextElementToBePresent({ ...locator });

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
          console.info(`Retrying long press and select all, attempt ${retries + 1}`);
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

    console.info(`Text has been cleared `);
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
        // console.info(`text ${text} looking for ${textToLookFor}`);
        if (text.toLowerCase().includes(textToLookFor.toLowerCase())) {
          console.info(`Text found to include ${textToLookFor}`);
        }
        return Boolean(text && text.toLowerCase() === textToLookFor.toLowerCase());
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
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: textToLookFor,
    });

    const message = await this.findMatchingTextAndAccessibilityId('Message body', textToLookFor);
    return message;
  }

  public async doesElementExist(
    args: { text?: string; maxWait?: number } & (StrategyExtractionObj | LocatorsInterface)
  ) {
    const { text, maxWait } = args;
    const beforeStart = Date.now();
    const maxWaitMSec = maxWait || 30000;
    const waitPerLoop = 100;
    let element: AppiumNextElementType | null = null;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    while (element === null) {
      try {
        if (!text) {
          element = await this.findElement(locator.strategy, locator.selector);
        } else {
          const els = await this.findElements(locator.strategy, locator.selector);
          element = await this.findMatchingTextInElementArray(els, text);
          if (element) {
            console.log(
              `${locator.strategy}: ${locator.selector} with matching text ${text} found`
            );
          } else {
            console.log(
              `Couldn't find ${text} with matching ${locator.strategy}: ${locator.selector}`
            );
          }
        }
      } catch (e: any) {
        console.info(`doesElementExist failed with`, `${locator.strategy} ${locator.selector}`);
      }
      if (!element) {
        await sleepFor(waitPerLoop);
      }
      if (beforeStart + maxWaitMSec <= Date.now()) {
        console.log(locator.selector, " doesn't exist, time expired");
        break;
      } else {
        console.log(locator.selector, "Doesn't exist but retrying");
      }
    }

    return element;
  }

  public async hasElementBeenDeleted({
    text,
    maxWait = 15000,
    ...args
  }: {
    text?: string;
    maxWait?: number;
  } & StrategyExtractionObj) {
    const start = Date.now();
    let element: AppiumNextElementType | undefined = undefined;
    do {
      if (!text) {
        try {
          element = await this.waitForTextElementToBePresent({
            text: text,
            maxWait: 100,
            ...args,
          });
          await sleepFor(100);
          console.log(`Element has been found, waiting for deletion`);
        } catch (e: any) {
          element = undefined;
          console.log(`Element has been deleted, great success`);
        }
      } else {
        try {
          element = await this.waitForTextElementToBePresent({
            maxWait: 100,
            ...args,
          });
          await sleepFor(100);
          console.log(`Text element has been found, waiting for deletion`);
        } catch (e) {
          element = undefined;
          console.log(`Text element has been deleted, great success`);
        }
      }
    } while (Date.now() - start <= maxWait && element);
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
    console.log(accessibilityId, ': ', text, 'is not visible, congratulations');
  }
  // WAIT FOR FUNCTIONS

  public async waitForTextElementToBePresent(
    args: {
      text?: string;
      maxWait?: number;
    } & (StrategyExtractionObj | LocatorsInterface)
  ): Promise<AppiumNextElementType> {
    let el: null | AppiumNextElementType = null;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    const { text, maxWait } = args;

    const maxWaitMSec: number = typeof maxWait === 'number' ? maxWait : 60000;
    let currentWait = 0;
    const waitPerLoop = 100;
    while (el === null) {
      try {
        if (text) {
          console.log(
            `Waiting for ${locator.strategy}: '${locator.selector}' to be present with ${text}`
          );
          const els = await this.findElements(locator.strategy, locator.selector);
          el = await this.findMatchingTextInElementArray(els, text);
        } else {
          console.log(`Waiting for ${locator.strategy} and ${locator.selector} to be present`);
          el = await this.findElement(locator.strategy, locator.selector);
        }
      } catch (e: any) {
        console.info(
          'waitForTextElementToBePresent threw: ',
          `${locator.strategy}: '${locator.selector}'`
        );
      }
      if (!el) {
        await sleepFor(waitPerLoop);
      }
      currentWait += waitPerLoop;

      if (currentWait >= maxWaitMSec) {
        if (text) {
          throw new Error(`Waited for too long looking for '${locator.selector}' and '${text}`);
        }
        throw new Error(`Waited for too long looking for '${locator.selector}'`);
      }
      if (text) {
        console.log(`'${locator.selector}' and '${text}' has been found`);
      } else {
        console.log(`'${locator.selector}' has been found`);
      }
    }
    return el;
  }

  public async waitForControlMessageToBePresent(
    text: string,
    maxWait?: number
  ): Promise<AppiumNextElementType> {
    let el: null | AppiumNextElementType = null;
    const maxWaitMSec: number = typeof maxWait === 'number' ? maxWait : 15000;
    let currentWait = 0;
    const waitPerLoop = 100;
    while (el === null) {
      try {
        console.log(`Waiting for control message to be present with ${text}`);
        const els = await this.findElements('accessibility id', 'Control message');
        el = await this.findMatchingTextInElementArray(els, text);
      } catch (e: any) {
        console.info('waitForControlMessageToBePresent threw: ', e.message);
      }
      if (!el) {
        await sleepFor(waitPerLoop);
      }
      currentWait += waitPerLoop;
      if (currentWait >= maxWaitMSec) {
        console.log('Waited too long');
        throw new Error(`Waited for too long looking for Control message ${text}`);
      }
    }
    console.log(`Control message ${text} has been found`);
    return el;
  }

  public async disappearingControlMessage(
    text: string,
    maxWait?: number
  ): Promise<AppiumNextElementType> {
    let el: null | AppiumNextElementType = null;
    const maxWaitMSec: number = typeof maxWait === 'number' ? maxWait : 15000;
    let currentWait = 0;
    const waitPerLoop = 100;
    while (el === null) {
      try {
        console.log(`Waiting for control message to be present with ${text}`);
        const els = await this.findElements('accessibility id', 'Control message');
        el = await this.findMatchingTextInElementArray(els, text);
      } catch (e) {
        console.info('disappearingControlMessage threw: ', e);
      }
      if (!el) {
        await sleepFor(waitPerLoop);
      }
      currentWait += waitPerLoop;
      if (currentWait >= maxWaitMSec) {
        console.log('Waited too long');
        throw new Error(`Waited for too long looking for Control message ${text}`);
      }
    }
    console.log(`Control message ${text} has been found`);
    return el;
  }

  public async waitForLoadingMedia() {
    let loadingAnimation: AppiumNextElementType | null = null;

    do {
      try {
        loadingAnimation = await this.waitForTextElementToBePresent({
          strategy: 'id',
          selector: 'network.loki.messenger:id/thumbnail_load_indicator',
          maxWait: 1000,
        });

        if (loadingAnimation) {
          await sleepFor(100);
          console.info('Loading animation was found, waiting for it to be gone');
        }
      } catch (e: any) {
        console.log('Loading animation not found');
        loadingAnimation = null;
      }
    } while (loadingAnimation);

    console.info('Loading animation has finished');
  }

  public async waitForLoadingOnboarding() {
    let loadingAnimation: AppiumNextElementType | null = null;
    do {
      try {
        loadingAnimation = await this.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Loading animation',
          maxWait: 1000,
        });

        if (loadingAnimation) {
          await sleepFor(500);
          console.info('Loading animation was found, waiting for it to be gone');
        }
      } catch (e: any) {
        console.log('Loading animation not found');
        loadingAnimation = null;
      }
    } while (loadingAnimation);

    console.info('Loading animation has finished');
  }

  // UTILITY FUNCTIONS

  public async sendMessage(message: string) {
    await this.inputText(message, { strategy: 'accessibility id', selector: 'Message input box' });

    // Click send

    const sendButton = await this.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Send message button',
    });
    if (!sendButton) {
      throw new Error('Send button not found: Need to restart iOS emulator: Known issue');
    }
    // Wait for tick
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: `Message sent status: Sent`,
      maxWait: 50000,
    });

    return message;
  }

  public async waitForSentConfirmation() {
    let pendingStatus = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message sent status: Sending',
    });
    const failedStatus = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message sent status: Failed to send',
    });
    if (pendingStatus || failedStatus) {
      await sleepFor(100);
      pendingStatus = await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message sent status: Sending',
      });
    }
  }

  public async sendNewMessage(user: User, message: string) {
    // Sender workflow
    // Click on plus button
    await this.clickOnByAccessibilityID('New conversation button');
    // Select direct message option
    await this.clickOnByAccessibilityID('New direct message');
    // Enter User B's session ID into input box
    await this.inputText(user.accountID, {
      strategy: 'accessibility id',
      selector: 'Session id input box',
    });
    // Click next
    await this.scrollDown();
    await this.clickOnByAccessibilityID('Next');
    // Type message into message input box

    await this.inputText(message, { strategy: 'accessibility id', selector: 'Message input box' });
    // Click send
    const sendButton = await this.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Send message button',
    });
    if (!sendButton) {
      throw new Error('Send button not found: Need to restart iOS emulator: Known issue');
    }
    // Wait for tick

    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: `Message sent status: Sent`,
      maxWait: 50000,
    });

    return message;
  }

  public async sendMessageTo(sender: User, receiver: User | Group) {
    const message = `${sender.userName} to ${receiver.userName}`;
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: receiver.userName,
    });
    await sleepFor(100);
    await this.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: receiver.userName,
    });
    console.log(`${sender.userName} + " sent message to ${receiver.userName}`);
    await this.sendMessage(message);
    console.log(`Message received by ${receiver.userName} from ${sender.userName}`);
    return message;
  }

  public async replyToMessage(user: User, body: string) {
    // Reply to media message from user B
    // Long press on imageSent element
    await this.longPressMessage(body);
    const longPressSuccess = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Reply to message',
      maxWait: 1000,
    });
    if (longPressSuccess) {
      await this.clickOnByAccessibilityID('Reply to message');
    } else {
      throw new Error(`Long press failed on ${body}`);
    }
    // Select 'Reply' option
    // Send message
    const replyMessage = await this.sendMessage(`${user.userName} + " replied to ${body}`);

    return replyMessage;
  }

  public async measureSendingTime(messageNumber: number) {
    const message = `Test-message`;
    const timeStart = Date.now();

    await this.sendMessage(message);

    const timeEnd = Date.now();
    const timeMs = timeEnd - timeStart;

    console.log(`Message ${messageNumber}: ${timeMs}`);
    return timeMs;
  }

  public async inputText(
    textToInput: string,
    args: ({ maxWait?: number } & StrategyExtractionObj) | LocatorsInterface
  ) {
    let el: null | AppiumNextElementType = null;
    const locator = args instanceof LocatorsInterface ? args.build() : args;

    console.log('Locator being used:', locator);

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
        console.log('Great success - default time is correct');
      } else {
        throw new Error('Dammit - default time was not correct');
      }
    } else {
      const radioButton = await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: timeOption,
      });
      const attr = await this.getAttribute('selected', radioButton.ELEMENT);
      if (!attr) {
        throw new Error('Dammit - default time was not correct');
      }
      console.log('Great success - default time is correct');
    }
  }

  public async pushMediaToDevice(
    platform: SupportedPlatformsType,
    mediaFileName: string,
    forcedDate?: string
  ) {
    if (platform === 'ios') {
      await runScriptAndLog(`touch -a -m -t ${forcedDate} 'run/test/specs/media/${mediaFileName}'`);
      await runScriptAndLog(`xcrun simctl addmedia 'run/test/specs/media/${mediaFileName}'`);
    } else {
      await runScriptAndLog(
        `${getAdbFullPath()} -s emulator-5554 push 'run/test/specs/media/${mediaFileName}' /storage/emulated/0/Download`
      );
      // Refreshes the photos UI to force the image appear
      await runScriptAndLog(
        `${getAdbFullPath()} -s emulator-5554 shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///storage/emulated/0/Download/${mediaFileName}`
      );
    }
  }

  // TODO FIX UP THIS FUNCTION
  public async sendImage(platform: SupportedPlatformsType, message?: string, community?: boolean) {
    const ronSwansonBirthday = '196705060700.00';
    const formattedDate = '1967-05-05 21:00:00 +0000';
    const fileName = 'test_image.jpg';
    if (platform === 'ios') {
      await this.clickOnByAccessibilityID('Attachments button');
      await sleepFor(5000);
      const keyboard = await this.isKeyboardVisible();
      if (keyboard) {
        await clickOnCoordinates(this, InteractionPoints.ImagesFolderKeyboardOpen);
      } else {
        await clickOnCoordinates(this, InteractionPoints.ImagesFolderKeyboardClosed);
      }
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      const testImage = await this.doesElementExist({
        strategy: 'accessibility id',
        selector: formattedDate,
        maxWait: 1000,
      });
      if (!testImage) {
        await this.pushMediaToDevice(platform, fileName, ronSwansonBirthday);
      }
      await sleepFor(100);
      await this.clickOnByAccessibilityID(formattedDate, 1000);
      if (message) {
        await this.clickOnByAccessibilityID('Text input box');
        await this.inputText(message, { strategy: 'accessibility id', selector: 'Text input box' });
      }
      await this.clickOnElementAll(new SendMediaButton(this));
      await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message sent status: Sent',
        maxWait: 50000,
      });
    } else {
      await this.clickOnByAccessibilityID('Attachments button');
      await sleepFor(100);
      await this.clickOnByAccessibilityID('Documents folder');
      await this.clickOnByAccessibilityID('Continue');
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_allow_button',
        text: 'Allow',
      });
      await this.clickOnByAccessibilityID('Show roots');
      await sleepFor(100);
      await this.clickOnTextElementById(`android:id/title`, 'Downloads');
      await sleepFor(100);
      const testImage = await this.doesElementExist({
        strategy: 'id',
        selector: 'android:id/title',
        maxWait: 2000,
        text: fileName,
      });
      if (!testImage) {
        await this.pushMediaToDevice(platform, fileName);
      }
      await sleepFor(100);
      await this.clickOnTextElementById('android:id/title', fileName);
      if (community) {
        await this.scrollToBottom(platform);
      }
      await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: `Message sent status: Sent`,
        maxWait: 60000,
      });
    }
  }

  public async sendImageWithMessageAndroid(message: string) {
    await this.clickOnByAccessibilityID('Attachments button');
    await sleepFor(100);
    await this.clickOnByAccessibilityID('Images folder');
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
    await this.inputText(message, {
      strategy: 'accessibility id',
      selector: 'New direct message',
    });
    await this.clickOnElementAll(new SendMediaButton(this));
  }

  public async sendVideoiOS(message: string) {
    const bestDayOfYear = `198809090700.00`;
    const formattedDate = `1988-09-08 21:00:00 +0000`;
    const fileName = 'test_video.mp4';
    await this.clickOnByAccessibilityID('Attachments button');
    // Select images button/tab
    await sleepFor(5000);
    const keyboard = await this.isKeyboardVisible();
    if (keyboard) {
      await clickOnCoordinates(this, InteractionPoints.ImagesFolderKeyboardOpen);
    } else {
      await clickOnCoordinates(this, InteractionPoints.ImagesFolderKeyboardClosed);
    }
    await sleepFor(100);
    await this.modalPopup({
      strategy: 'accessibility id',
      selector: 'Allow Full Access',
      maxWait: 500,
    });
    await this.clickOnByAccessibilityID('Recents');
    // Select video
    const videoFolder = await this.doesElementExist({
      strategy: 'xpath',
      selector: IOS_XPATHS.VIDEO_TOGGLE,
      maxWait: 5000,
    });
    if (videoFolder) {
      console.log('Videos folder found');
      await this.clickOnByAccessibilityID('Videos');
      await this.clickOnByAccessibilityID(formattedDate);
    } else {
      console.log('Videos folder NOT found');
      await this.pushMediaToDevice('ios', fileName, bestDayOfYear);
      await this.clickOnByAccessibilityID(formattedDate, 5000);
    }
    // Send with message
    await this.clickOnByAccessibilityID('Text input box');
    await this.inputText(message, { strategy: 'accessibility id', selector: 'Text input box' });
    await this.clickOnByAccessibilityID('Send button');
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: `Message sent status: Sent`,
      maxWait: 10000,
    });
  }

  public async sendVideoAndroid() {
    const fileName = 'test_video.mp4';
    // Click on attachments button
    await this.clickOnByAccessibilityID('Attachments button');
    await sleepFor(100);
    // Select images button/tab
    await this.clickOnByAccessibilityID('Documents folder');
    await this.clickOnByAccessibilityID('Continue');
    await this.clickOnElementAll({
      strategy: 'id',
      selector: 'com.android.permissioncontroller:id/permission_allow_button',
      text: 'Allow',
    });
    await sleepFor(200);
    // Select video
    const mediaButtons = await this.findElementsByClass('android.widget.Button');
    const videosButton = await this.findMatchingTextInElementArray(mediaButtons, 'Videos');
    if (!videosButton) {
      throw new Error('videosButton was not found');
    }
    await this.click(videosButton.ELEMENT);
    const testVideo = await this.doesElementExist({
      strategy: 'id',
      selector: 'android:id/title',
      maxWait: 1000,
      text: fileName,
    });
    if (!testVideo) {
      await this.pushMediaToDevice('android', fileName);
    }
    await sleepFor(100);
    await this.clickOnTextElementById('android:id/title', fileName);
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: `Message sent status: Sent`,
      maxWait: 50000,
    });
  }

  public async sendDocument() {
    const fileName = 'test_file.pdf';
    if (this.isAndroid()) {
      await this.clickOnByAccessibilityID('Attachments button');
      await this.clickOnByAccessibilityID('Documents folder');
      await this.clickOnByAccessibilityID('Continue');
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_allow_button',
        text: 'Allow',
      });
      await this.waitForTextElementToBePresent({
        strategy: 'class name',
        selector: 'android.widget.Button',
        text: 'Documents',
      });
      await this.clickOnElementAll({
        strategy: 'class name',
        selector: 'android.widget.Button',
        text: 'Documents',
      });
      const testDocument = await this.doesElementExist({
        strategy: 'id',
        selector: 'android:id/title',
        maxWait: 1000,
        text: fileName,
      });
      if (!testDocument) {
        await this.pushMediaToDevice('android', fileName);
      }
      await sleepFor(1000);
      await this.clickOnTextElementById('android:id/title', fileName);
      await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: `Message sent status: Sent`,
        maxWait: 50000,
      });
    }
    if (this.isIOS()) {
      const formattedFileName = 'test_file, pdf';
      const testMessage = 'Testing-document-1';
      const spongeBobsBirthday = '199905010700.00';
      await this.clickOnByAccessibilityID('Attachments button');
      await sleepFor(100);
      await clickOnCoordinates(this, InteractionPoints.DocumentKeyboardOpen);
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      const testDocument = await this.doesElementExist({
        strategy: 'accessibility id',
        selector: formattedFileName,
        text: undefined,
        maxWait: 1000,
      });

      if (!testDocument) {
        await this.pushMediaToDevice('ios', fileName, spongeBobsBirthday);
      }
      await sleepFor(100);
      await this.clickOnByAccessibilityID(formattedFileName);
      await sleepFor(500);
      await this.clickOnByAccessibilityID('Text input box');
      await this.inputText(testMessage, {
        strategy: 'accessibility id',
        selector: 'Text input box',
      });
      await this.clickOnByAccessibilityID('Send button');
    }
  }

  public async sendGIF(message: string) {
    await this.clickOnByAccessibilityID('Attachments button');
    if (this.isAndroid()) {
      await this.clickOnElementAll({ strategy: 'accessibility id', selector: 'GIF button' });
    }
    if (this.isIOS()) {
      const keyboard = await this.isKeyboardVisible();
      if (keyboard) {
        await clickOnCoordinates(this, InteractionPoints.GifButtonKeyboardOpen);
      } else {
        await clickOnCoordinates(this, InteractionPoints.GifButtonKeyboardClosed);
      }
    }
    await this.clickOnByAccessibilityID('Continue', 5000);
    await this.clickOnElementAll(new FirstGif(this));
    if (this.isIOS()) {
      await this.clickOnByAccessibilityID('Text input box');
      await this.inputText(message, {
        strategy: 'accessibility id',
        selector: 'Text input box',
      });
      await this.clickOnByAccessibilityID('Send button');
    }
  }

  public async sendVoiceMessage() {
    const maxRetries = 3;
    let attempt = 0;
    await this.longPress('New voice message');
    if (this.isAndroid()) {
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
        text: 'While using the app',
      });
      try {
        const el = await this.doesElementExist({
          strategy: 'accessibility id',
          selector: 'New voice message',
        });
        if (!el) {
          throw new Error(`longPress on voice message unsuccessful, couldn't find message`);
        }
        await this.pressAndHold('New voice message');
        const longPressSuccess = await this.doesElementExist({
          strategy: 'accessibility id',
          selector: 'Reply to message',
          maxWait: 1000,
        });

        if (longPressSuccess) {
          console.log('LongClick successful'); // Exit the loop if successful
        } else {
          throw new Error(`longPress on voice message unsuccessful`);
        }
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error(
            `Longpress on on voice message unsuccessful after ${maxRetries} attempts, ${error as string}`
          );
        }
        console.log(`Longpress attempt ${attempt} failed. Retrying...`);
        await sleepFor(1000);
      }
    } else if (this.isIOS()) {
      // await this.pressAndHold('New voice message');
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow' });
      await this.pressAndHold('New voice message');
    }
  }

  public async uploadProfilePicture() {
    const spongeBobsBirthday = '199805010700.00';
    const formattedDateiOS = 'Photo, 01 May 1998, 7:00 am';
    const formattedDateAndroid = 'profile_picture.jpg, 27.75 kB, May 1, 1998';
    const fileName = 'profile_picture.jpg';
    await this.clickOnElementAll(new UserSettings(this));
    // Click on Profile picture
    await this.clickOnElementAll(new UserSettings(this));
    await this.clickOnElementAll(new ChangeProfilePictureButton(this));
    if (this.isIOS()) {
      await this.modalPopup({ strategy: 'accessibility id', selector: 'Allow Full Access' });
      const profilePicture = await this.doesElementExist({
        strategy: 'accessibility id',
        selector: formattedDateiOS,
        maxWait: 2000,
      });
      if (!profilePicture) {
        await this.pushMediaToDevice('ios', fileName, spongeBobsBirthday);
      }
      await sleepFor(100);
      await this.clickOnElementAll({
        strategy: 'accessibility id',
        selector: formattedDateiOS,
      });
      await this.clickOnByAccessibilityID('Done');
    } else if (this.isAndroid()) {
      await this.clickOnElementAll(new ImagePermissionsModalAllow(this));
      await sleepFor(1000);
      await this.clickOnElementAll({
        strategy: 'id',
        selector: 'android:id/text1',
        text: 'Files',
      });
      await sleepFor(500);
      // Select file
      const profilePicture = await this.doesElementExist({
        strategy: 'accessibility id',
        selector: formattedDateAndroid,
        maxWait: 5000,
      });
      // If no image, push file to this
      if (!profilePicture) {
        await this.pushMediaToDevice('android', fileName);
        await this.clickOnElementAll({ strategy: 'accessibility id', selector: 'Show roots' });
        await this.clickOnElementAll({
          strategy: 'id',
          selector: 'android:id/title',
          text: 'Downloads',
        });
      }
      await this.clickOnElementAll({
        strategy: 'accessibility id',
        selector: formattedDateAndroid,
      });
      await this.clickOnElementById('network.loki.messenger:id/crop_image_menu_crop');
    }
    await this.clickOnElementAll(new SaveProfilePictureButton(this));
  }

  public async getTimeFromDevice(platform: SupportedPlatformsType): Promise<string> {
    let timeString = '';
    try {
      const time = await this.getDeviceTime(platform);
      timeString = time.toString();
      console.log(`Device time: ${timeString}`);
    } catch (e) {
      console.log(`Couldn't get time from device`);
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
    console.log(`Not an iOS device: shouldn't use this function`);
  }

  public async mentionContact(platform: SupportedPlatformsType, contact: User) {
    await this.inputText(`@`, { strategy: 'accessibility id', selector: 'Message input box' });
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
      await this.clickOnElementAll({
        strategy: 'accessibility id',
        selector: 'Contact',
        text: contact.userName,
      });
    }
    await this.clickOnByAccessibilityID('Send message button');
    await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: `Message sent status: Sent`,
    });
  }

  // ACTIONS
  public async swipeLeftAny(selector: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector,
    });

    const loc = await this.getElementRect(el.ELEMENT);
    console.log(loc);

    if (!loc) {
      throw new Error('did not find element rectangle');
    }
    await this.scroll(
      { x: loc.x + loc.width, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width / 2, y: loc.y + loc.height / 2 },
      1000
    );

    console.info('Swiped left on ', selector);
  }
  public async swipeRightAny(selector: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector,
    });

    const loc = await this.getElementRect(el.ELEMENT);
    console.log(loc);

    if (!loc) {
      throw new Error('did not find element rectangle');
    }
    await this.scroll(
      { x: loc.x + loc.width * 2, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width * 8, y: loc.y + loc.height / 2 },
      500
    );

    console.info('Swiped right on ', selector);
  }
  public async swipeLeft(accessibilityId: AccessibilityId, text: string) {
    const el = await this.findMatchingTextAndAccessibilityId(accessibilityId, text);

    const loc = await this.getElementRect(el.ELEMENT);
    console.log(loc);

    if (!loc) {
      throw new Error('did not find element rectangle');
    }
    await this.scroll(
      { x: loc.x + loc.width, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width / 2, y: loc.y + loc.height / 2 },
      1000
    );

    console.info('Swiped left on ', el);
    // let some time for swipe action to happen and UI to update
  }

  public async scrollDown() {
    await this.scroll({ x: 760, y: 1500 }, { x: 760, y: 710 }, 100);
  }

  public async scrollToBottom(platform: SupportedPlatformsType) {
    if (platform === 'android') {
      const scrollButton = await this.doesElementExist({
        strategy: 'id',
        selector: 'network.loki.messenger:id/scrollToBottomButton',
      });
      if (scrollButton) {
        await this.clickOnElementAll({
          strategy: 'id',
          selector: 'network.loki.messenger:id/scrollToBottomButton',
        });
      } else {
        console.info('Scroll button not visible');
      }
    } else {
      await this.clickOnElementAll({
        strategy: 'accessibility id',
        selector: 'Scroll button',
      });
    }
  }

  public async navigateBack() {
    if (this.isIOS()) {
      await this.clickOnByAccessibilityID('Back');
    } else {
      await this.clickOnByAccessibilityID('Navigate up');
    }
  }

  /* ======= Settings functions =========*/

  public async turnOnReadReceipts() {
    await this.navigateBack();
    await sleepFor(100);
    await this.clickOnElementAll(new UserSettings(this));
    await sleepFor(500);
    await this.clickOnElementAll(new PrivacyButton(this));
    await sleepFor(2000);
    await this.clickOnElementAll(new ReadReceiptsButton(this));
    await this.navigateBack();
    await sleepFor(100);
    await this.clickOnElementAll(new ExitUserProfile(this));
  }

  public async checkPermissions(
    selector: Extract<AccessibilityId, 'Allow Full Access' | 'Don’t Allow' | 'Allow'>
  ) {
    if (this.isAndroid()) {
      const permissions = await this.doesElementExist({
        strategy: 'id',
        selector: 'com.android.permissioncontroller:id/permission_deny_button',
        maxWait: 1000,
      });

      if (permissions) {
        await this.clickOnElementAll({
          strategy: 'id',
          selector: 'com.android.permissioncontroller:id/permission_deny_button',
        });
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
          strategy: 'accessibility id',
          selector,
          maxWait: 500,
        });
        if (iosPermissions) {
          await this.clickOnByAccessibilityID(selector);
        }
      } catch (e) {
        console.info('iosPermissions doesElementExist failed with: ', e);
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
        maxWait: 500,
      });
      console.info('iosPermissions', iosPermissions);
      if (iosPermissions) {
        await this.clickOnElementAll({ ...args, maxWait });
      } else {
        console.info('No iosPermissions', iosPermissions);
      }
    } catch (e) {
      console.info('FAILED WITH', e);
      // Ignore any exceptions during the action
    }

    // Revert to the original app context
    await this.updateSettings({
      defaultActiveApplication: activeAppInfo.bundleId,
    });
    return;
  }

  public async checkModalStrings(
    expectedHeading: string,
    expectedDescription: string,
    oldModalAndroid?: boolean
  ) {
    // Check modal heading is correct
    function removeNewLines(input: string): string {
      return input.replace(/\n/gi, '');
    }

    let elHeading;
    // Some modals in Android haven't been updated to compose yet therefore need different locators
    if (!oldModalAndroid) {
      elHeading = await this.waitForTextElementToBePresent(new ModalHeading(this));
    } else {
      elHeading = await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Modal heading',
      });
    }
    const actualHeading = await this.getTextFromElement(elHeading);
    if (expectedHeading === actualHeading) {
      console.log('Modal heading is correct');
    } else {
      throw new Error(
        `Modal heading is incorrect. Expected heading: ${expectedHeading}, Actual heading: ${actualHeading}`
      );
    }
    // Now check modal description
    let elDescription;
    if (!oldModalAndroid) {
      elDescription = await this.waitForTextElementToBePresent(new ModalDescription(this));
    } else {
      elDescription = await this.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Modal description',
      });
    }
    const actualDescription = await this.getTextFromElement(elDescription);
    // Need to format the ACTUAL description that comes back from device to match
    const formattedDescription = removeNewLines(actualDescription);
    if (expectedDescription !== formattedDescription) {
      throw new Error(
        `Modal description is incorrect. Expected description: ${expectedDescription}, Actual description: ${formattedDescription}`
      );
    } else {
      console.log('Modal description is correct');
    }
  }

  public async getElementPixelColor(
    args: {
      text?: string;
      maxWait?: number;
    } & (StrategyExtractionObj | LocatorsInterface)
  ): Promise<string> {
    // Wait for the element to be present
    const element = await this.waitForTextElementToBePresent(args);
    // Take a screenshot and return a hex color value
    const base64image = await this.getElementScreenshot(element.ELEMENT);
    const pixelColor = await parseDataImage(base64image);
    return pixelColor;
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
