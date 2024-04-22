import { W3CCapabilities } from "@wdio/types/build/Capabilities";
import { isArray, isEmpty } from "lodash";
import { AppiumNextElementType } from "../../appium_next";
import { clickOnCoordinates, sleepFor } from "../test/specs/utils";
import { getIosFirstSimulator } from "../test/specs/utils/config";
import { SupportedPlatformsType } from "../test/specs/utils/open_app";
import { isDeviceAndroid, isDeviceIOS, runScriptAndLog } from "../test/specs/utils/utilities";
import {
  AccessibilityId,
  ControlMessage,
  DMTimeOption,
  Group,
  InteractionPoints,
  Strategy,
  StrategyExtractionObj,
  User,
  XPath,
} from "./testing";

export type Coordinates = {
  x: number;
  y: number;
};
export type ActionSequence = {
  actions: string;
};

type Action = Coordinates & { type: "pointer"; duration?: number };

type SharedDeviceInterface = {
  getPageSource: () => Promise<string>;
  back: () => Promise<void>;
  click: (elementId: string) => Promise<void>;
  doubleClick: (elementId: string) => Promise<void>;
  clear: (elementId: string) => Promise<void>;
  getText: (elementId: string) => Promise<string>;
  setValueImmediate: (text: string, elementId: string) => Promise<void>;
  getAttribute: (attribute: string, elementId: string) => Promise<string>;
  keys: (value: string[]) => Promise<void>;
  getElementRect: (elementId: string) => Promise<undefined | { height: number; width: number; x: number; y: number }>;
  getCssProperty: (name: string, elementId: string) => Promise<string>;
  pushFile(path: string, data: string): Promise<void>;
  getElementScreenshot: (elementId: string) => Promise<string>;
  // gestures
  scroll: (start: Coordinates, end: Coordinates, duration: number) => Promise<void>;
  pressCoordinates: (xCoOrdinates: number, yCoOrdinates: number, duration?: number) => Promise<void>;
  performActions: (actions: any) => Promise<any>;
  performTouch: (actions: Action[]) => Promise<any>;
  // touchAction: (actions: Action) => Promise<any>;
  tap: (xCoOrdinates: number, yCoOrdinates: number, duration?: number) => Promise<any>;
  touchUp(CoOrdinates: Coordinates): Promise<void>;
  touchDown(CoOrdinates: Coordinates): Promise<void>;
  touchScroll(x: Coordinates, y: Coordinates, element: AppiumNextElementType): Promise<AppiumNextElementType>;
  // finding elements

  findElement(strategy: Strategy, selector: string): Promise<AppiumNextElementType>;
  findElements(strategy: Strategy, selector: string): Promise<Array<AppiumNextElementType>>;

  // Session management
  createSession: (caps: W3CCapabilities) => Promise<[string, Record<string, any>]>;
  deleteSession: (sessionId?: string) => Promise<void>;
};

type IOSDeviceInterface = {
  mobileTouchAndHold: (duration: number /* In seconds */, x: any, y: any, elementId: string) => Promise<void>;
} & SharedDeviceInterface;

type AndroidDeviceInterface = {
  touchLongClick: (id: string) => Promise<void>;
} & SharedDeviceInterface;

export class DeviceWrapper implements SharedDeviceInterface {
  private readonly device: DeviceWrapper;

  constructor(device: DeviceWrapper) {
    this.device = device;
  }

  public async touchScroll(x: Coordinates, y: Coordinates, element: AppiumNextElementType) {
    return this.toShared().touchScroll(x, y, element);
  }

  /**  === all the shared actions ===  */
  public async click(element: string) {
    // this one works for both devices so just call it without casting it
    return this.toShared().click(element);
  }
  public async doubleClick(elementId: string): Promise<void> {
    return this.toShared().doubleClick(elementId);
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
  ): Promise<undefined | { height: number; width: number; x: number; y: number }> {
    return this.toShared().getElementRect(elementId);
  }

  public async getCssProperty(name: string, elementId: string): Promise<string> {
    return this.toShared().getCssProperty(name, elementId);
  }

  public async scroll(start: Coordinates, end: Coordinates, duration: number): Promise<void> {
    const actions = [
      {
        type: "pointer",
        id: "finger1",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: start.x, y: start.y },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 500 },
          {
            type: "pointerMove",
            duration,
            origin: "pointer",
            x: end.x - start.x,
            y: end.y - start.y,
          },
          { type: "pointerUp", button: 0 },
        ],
      },
    ];

    await this.toShared().performActions(actions);
  }

  public async pressCoordinates(xCoOrdinates: number, yCoOrdinates: number): Promise<void> {
    const actions = [
      {
        type: "pointer",
        id: "finger1",
        parameters: { pointerType: "touch" },
        actions: [
          {
            type: "pointerMove",
            duration: 0,
            x: xCoOrdinates,
            y: yCoOrdinates,
          },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 200 },

          { type: "pointerUp", button: 0 },
        ],
      },
    ];

    await this.toShared().performActions(actions);
  }

  public async tap(xCoOrdinates: number, yCoOrdinates: number, duration?: number): Promise<void> {
    const action: Action = {
      type: "pointer",
      x: xCoOrdinates,
      y: yCoOrdinates,
      duration: duration,
    };

    const actions = [action];
    await this.toShared().performTouch(actions);
  }

  public async performActions(actions: ActionSequence): Promise<void> {
    await this.toShared().performActions(actions);
  }

  public async performTouch(actions: Action[]): Promise<any> {
    return this.toShared().performTouch(actions);
  }

  public async pushFile(path: string, data: string): Promise<void> {
    console.log("Did file get pushed", path);
    return this.toShared().pushFile(path, data);
  }

  public async getElementScreenshot(elementId: string): Promise<string> {
    return this.toShared().getElementScreenshot(elementId);
  }

  public async touchUp(CoOrdinates: Coordinates): Promise<void> {
    return this.toShared().touchUp(CoOrdinates);
  }
  public async touchDown(CoOrdinates: Coordinates): Promise<void> {
    return this.toShared().touchDown(CoOrdinates);
  }

  // Session management
  public async createSession(caps: W3CCapabilities): Promise<[string, Record<string, any>]> {
    return this.toShared().createSession(caps);
  }

  public async deleteSession(sessionId?: string): Promise<void> {
    return this.toShared().deleteSession(sessionId);
  }

  public async getPageSource(): Promise<string> {
    return this.toShared().getPageSource();
  }

  /* === all the device-specifc function ===  */

  // ELEMENT INTERACTION

  public async findElement(strategy: Strategy, selector: string): Promise<AppiumNextElementType> {
    return this.toShared().findElement(strategy, selector);
  }

  public async findElements(strategy: Strategy, selector: string): Promise<Array<AppiumNextElementType>> {
    return this.toShared().findElements(strategy, selector);
  }

  public async longClick(element: AppiumNextElementType, durationMs: number) {
    if (this.isIOS()) {
      // iOS takes a number in seconds
      const duration = Math.floor(durationMs / 1000);
      return this.toIOS().mobileTouchAndHold(duration, undefined, undefined, element.ELEMENT);
    }
    return this.toAndroid().touchLongClick(element.ELEMENT);
  }

  public async clickOnElement(accessibilityId: AccessibilityId, maxWait?: number): Promise<void> {
    const el = await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
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
      if (error instanceof Error && error.name === "StaleElementReferenceError") {
        console.log("Element is stale, refinding element and attempting second click");
        await this.waitForTextElementToBePresent({
          strategy: "accessibility id",
          selector: accessibilityId,
          maxWait: 500,
        });
        await this.click(el.ELEMENT);
      }
    }
  }

  public async clickOnElementAll(args: { text?: string; maxWait?: number } & StrategyExtractionObj) {
    let el: null | AppiumNextElementType = null;
    const { text } = args;
    if (text) {
      el = await this.waitForTextElementToBePresent({ ...args, text });
    } else {
      el = await this.waitForTextElementToBePresent(args);
    }
    await this.click(el.ELEMENT);
    return el;
  }

  public async clickOnElementByText(args: { text: string; maxWait?: number } & StrategyExtractionObj) {
    const { text } = args;
    const el = await this.waitForTextElementToBePresent(args);

    if (!el) {
      throw new Error(`clickOnElementByText: Couldnt find text: ${text}`);
    }
    await this.click(el.ELEMENT);
  }

  public async clickOnElementXPath(xpath: XPath, maxWait?: number) {
    await this.waitForTextElementToBePresent({
      strategy: "xpath",
      selector: xpath,
      maxWait: maxWait,
    });
    const el = await this.findElementByXPath(xpath);

    await this.click(el.ELEMENT);
  }

  public async clickOnElementById(id: string) {
    await this.waitForTextElementToBePresent({ strategy: "id", selector: id });
    const el = await this.findElement("id", id);
    await this.click(el.ELEMENT);
  }

  public async clickOnTextElementById(id: string, text: string) {
    const el = await this.findTextElementArrayById(id, text);
    await this.waitForTextElementToBePresent({
      strategy: "id",
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

  public async longPress(accessibilityId: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: accessibilityId,
    });
    if (!el) {
      throw new Error(`longPress: Could not find accessibilityId: ${accessibilityId}`);
    }
    await this.longClick(el, 2000);
  }

  public async longPressMessage(textToLookFor: string) {
    try {
      const el = await this.waitForTextElementToBePresent({
        strategy: "accessibility id",
        selector: "Message body",
        text: textToLookFor,
      });

      await this.longClick(el, 2000);
      console.log("LongClick successful");
      if (!el) {
        throw new Error(`longPress on message: ${textToLookFor} unsuccessful, couldn't find message`);
      }
    } catch {
      console.log(`Longpress on message: `, textToLookFor, `unsuccessful`);
    }
  }

  public async longPressConversation(userName: string) {
    const el = await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Conversation list item",
      text: userName,
    });
    await this.longClick(el, 2000);
  }

  public async pressAndHold(accessibilityId: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: accessibilityId,
    });
    await this.longClick(el, 2000);
  }

  public async selectByText(accessibilityId: AccessibilityId, text: string) {
    await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
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
      strategy: "accessibility id",
      selector: accessibilityId,
    });
    const text = await this.getTextFromElement(elementId);
    return text;
  }

  public async deleteText(accessibilityId: AccessibilityId) {
    const el = await this.findElementByAccessibilityId(accessibilityId);
    await this.longClick(el, 500);
    if (this.isIOS()) {
      await this.clickOnElementByText({
        strategy: "id",
        selector: "Select All",
        text: "Select All",
      });
    }
    await this.clear(el.ELEMENT);
    console.warn(`Text has been cleared ${accessibilityId}`);
    return;
  }

  // ELEMENT LOCATORS

  public async findElementByAccessibilityId(accessibilityId: AccessibilityId): Promise<AppiumNextElementType> {
    const element = await this.findElement("accessibility id", accessibilityId);
    if (!element || isArray(element)) {
      throw new Error(
        `findElementByAccessibilityId: Did not find accessibilityId: ${accessibilityId} or it was an array `
      );
    }
    return element;
  }

  public async findElementsByAccessibilityId(accessibilityId: AccessibilityId): Promise<Array<AppiumNextElementType>> {
    const elements = await this.findElements("accessibility id", accessibilityId);
    if (!elements || !isArray(elements) || isEmpty(elements)) {
      throw new Error(`findElementsByAccessibilityId: Did not find accessibilityId: ${accessibilityId} `);
    }

    return elements;
  }

  public async findElementByXPath(xpath: XPath) {
    const element = await this.findElement("xpath", xpath);
    if (!element) {
      throw new Error(`findElementByXpath: Did not find xpath: ${xpath}`);
    }

    return element;
  }

  public async findElementByClass(androidClassName: string): Promise<AppiumNextElementType> {
    const element = await this.findElement("class name", androidClassName);
    if (!element) {
      throw new Error(`findElementByClass: Did not find classname: ${androidClassName}`);
    }
    return element;
  }

  public async findElementsByClass(androidClassName: string): Promise<Array<AppiumNextElementType>> {
    const elements = await this.findElements("class name", androidClassName);
    if (!elements) {
      throw new Error(`findElementsByClass: Did not find classname: ${androidClassName}`);
    }

    return elements;
  }

  public async findTextElementArrayById(id: string, textToLookFor: string): Promise<AppiumNextElementType> {
    const elementArray = await this.findElements("id", id);
    const selector = await this.findMatchingTextInElementArray(elementArray, textToLookFor);
    if (!selector) {
      throw new Error(`No matching selector found with text: ${textToLookFor}`);
    }

    return selector;
  }

  public async findText(strategy: Strategy, selector: string, text: string): Promise<AppiumNextElementType> {
    let el: null | AppiumNextElementType = null;
    console.log(`Waiting for accessibility ID '${selector}' to be present with ${text}`);
    while (el === null) {
      try {
        const els = await this.findElements(strategy, selector);
        el = await this.findMatchingTextInElementArray(els, text);
      } catch (e) {
        console.log(`findText threw an error`);
      }
    }
    return el;
  }

  public async findMatchingTextAndAccessibilityId(
    accessibilityId: AccessibilityId,
    textToLookFor: string
  ): Promise<AppiumNextElementType> {
    const elements = await this.findElementsByAccessibilityId(accessibilityId);

    const foundElementMatchingText = await this.findMatchingTextInElementArray(elements, textToLookFor);
    if (!foundElementMatchingText) {
      throw new Error(`Did not find element with accessibilityId ${accessibilityId} and text body: ${textToLookFor}`);
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
        // console.error(`text ${text} lookigfor ${textToLookFor}`);

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

  public async findLastElementInArray(accessibilityId: AccessibilityId): Promise<AppiumNextElementType> {
    const elements = await this.findElementsByAccessibilityId(accessibilityId);

    const [lastElement] = elements.slice(-1);

    if (!elements) {
      throw new Error(`No elements found with ${accessibilityId}`);
    }

    return lastElement;
  }

  public async findMessageWithBody(textToLookFor: string): Promise<AppiumNextElementType> {
    await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Message body",
      text: textToLookFor,
    });

    const message = await this.findMatchingTextAndAccessibilityId("Message body", textToLookFor);
    return message;
  }

  public async doesElementExist({
    strategy,
    selector,
    text,
    maxWait,
  }: { text?: string; maxWait?: number } & StrategyExtractionObj) {
    const beforeStart = Date.now();
    const maxWaitMSec = maxWait || 300000;
    const waitPerLoop = 100;
    let element: AppiumNextElementType | null = null;
    while (element === null) {
      try {
        if (!text) {
          element = await this.findElement(strategy, selector);
        } else {
          const els = await this.findElements(strategy, selector);
          element = await this.findMatchingTextInElementArray(els, text);
          if (element) {
            console.log(`${strategy}: ${selector} with matching text ${text} found`);
          } else {
            console.log(`Couldn't find ${text} with matching ${strategy}: ${selector}`);
          }
        }
      } catch (e: any) {
        // console.warn("doesElementExist failed with", e.message);
      }

      if (!element) {
        await sleepFor(waitPerLoop);
      }
      if (beforeStart + maxWaitMSec <= Date.now()) {
        console.log(selector, " doesn't exist, time expired");
        break;
      } else {
        console.log(selector, "Doesn't exist but retrying");
      }
    }

    return element;
  }

  public async hasElementBeenDeletedNew({
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
        } catch (e) {
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

  public async hasElementBeenDeleted(strategy: Strategy, selector: string) {
    const fakeError = `${selector}: has been found, but shouldn't have been. OOPS`;
    try {
      await this.findElement(strategy, selector);

      throw new Error(fakeError);
    } catch (e: any) {
      if (e.message === fakeError) {
        throw e;
      }
    }
    console.log(`${strategy}: ${selector} "is not visible, congratulations"`);
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
    console.log(accessibilityId, ": ", text, "is not visible, congratulations");
  }
  // WAIT FOR FUNCTIONS

  public async waitForTextElementToBePresent({
    strategy,
    selector,
    text,
    maxWait,
  }: {
    text?: string;
    maxWait?: number;
  } & StrategyExtractionObj): Promise<AppiumNextElementType> {
    let el: null | AppiumNextElementType = null;
    const maxWaitMSec: number = typeof maxWait === "number" ? maxWait : 15000;
    let currentWait = 0;
    const waitPerLoop = 100;
    while (el === null) {
      try {
        if (text) {
          console.log(`Waiting for ${strategy}: '${selector}' to be present with ${text}`);
          const els = await this.findElements(strategy, selector);
          el = await this.findMatchingTextInElementArray(els, text);
        } else {
          console.log(`Waiting for '${strategy}' and '${selector}' to be present`);
          el = await this.findElement(strategy, selector);
        }
      } catch (e: any) {
        console.warn("waitForTextElementToBePresent threw: ", e.message);
      }

      if (!el) {
        await sleepFor(waitPerLoop);
      }
      currentWait += waitPerLoop;

      if (currentWait >= maxWaitMSec) {
        console.log("Waited too long");
        throw new Error(`Waited for too long looking for '${selector}' and '${text || ""}`);
      }
    }
    console.log(`'${selector}' and '${text || ""}' has been found`);
    return el;
  }

  public async waitForControlMessageToBePresent(
    text: ControlMessage,
    maxWait?: number
  ): Promise<AppiumNextElementType> {
    let el: null | AppiumNextElementType = null;
    const maxWaitMSec: number = typeof maxWait === "number" ? maxWait : 15000;
    let currentWait = 0;
    const waitPerLoop = 100;
    while (el === null) {
      try {
        console.log(`Waiting for control message to be present with ${text}`);
        const els = await this.findElements("accessibility id", "Control message");
        el = await this.findMatchingTextInElementArray(els, text);
      } catch (e: any) {
        console.warn("waitForControlMessageToBePresent threw: ", e.message);
      }
      if (!el) {
        await sleepFor(waitPerLoop);
      }
      currentWait += waitPerLoop;
      if (currentWait >= maxWaitMSec) {
        console.log("Waited too long");
        throw new Error(`Waited for too long looking for Control message ${text}`);
      }
    }
    console.log(`Control message ${text} has been found`);
    return el;
  }

  public async waitForLoadingAnimation() {
    let loadingAnimation: AppiumNextElementType | null = null;

    do {
      try {
        loadingAnimation = await this.waitForTextElementToBePresent({
          strategy: "id",
          selector: "network.loki.messenger:id/thumbnail_load_indicator",
          maxWait: 1000,
        });
        await sleepFor(100);
        console.info("loading-animation was found, waiting for it to be gone");
      } catch (e: any) {
        console.log("Loading animation not found");
      }
    } while (loadingAnimation);
    console.info("Loading animation has finished");
  }

  // UTILITY FUNCTIONS

  public async sendMessage(message: string) {
    await this.inputText("accessibility id", "Message input box", message);
    // Click send
    await this.clickOnElement("Send message button");
    // Wait for tick
    await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: `Message sent status: Sent`,
      maxWait: 50000,
    });

    return message;
  }

  public async waitForSentConfirmation() {
    let pendingStatus = await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Message sent status: Sending",
    });
    const failedStatus = await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Message sent status: Failed to send",
    });
    if (pendingStatus || failedStatus) {
      await sleepFor(100);
      pendingStatus = await this.waitForTextElementToBePresent({
        strategy: "accessibility id",
        selector: "Message sent status: Sending",
      });
    }
  }

  public async sendNewMessage(user: User, message: string) {
    // Sender workflow
    // Click on plus button
    await this.clickOnElement("New conversation button");
    // Select direct message option
    await this.clickOnElement("New direct message");
    // Enter User B's session ID into input box
    await this.inputText("accessibility id", "Session id input box", user.sessionID);
    // Click next
    await this.scrollDown();
    await this.clickOnElement("Next");
    // Type message into message input box

    await this.inputText("accessibility id", "Message input box", message);
    // Click send
    await this.clickOnElement("Send message button");
    // Wait for tick

    await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: `Message sent status: Sent`,
      maxWait: 50000,
    });

    return message;
  }

  public async sendMessageTo(sender: User, receiver: User | Group) {
    const message = `${sender.userName} to ${receiver.userName}`;
    await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector: "Conversation list item",
      text: receiver.userName,
    });
    await sleepFor(100);
    await this.clickOnElementAll({
      strategy: "accessibility id",
      selector: "Conversation list item",
      text: receiver.userName,
    });
    console.log(`${sender.userName} + " sent message to ${receiver.userName}`);
    await this.sendMessage(message);
    console.log(`Message received by ${receiver.userName} from ${sender.userName}`);
  }

  public async replyToMessage(user: User, body: string) {
    // Reply to media message from user B
    // Long press on imageSent element
    await this.longPressMessage(body);
    // Select 'Reply' option
    await this.clickOnElement("Reply to message");
    // Send message
    const sentMessage = await this.sendMessage(`${user.userName} message reply`);

    return sentMessage;
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

  public async inputText(strategy: Extract<Strategy, "accessibility id">, selector: AccessibilityId, text: string) {
    await this.waitForTextElementToBePresent({ strategy, selector });

    const element = await this.findElementByAccessibilityId(selector);
    if (!element) {
      throw new Error(`inputText: Did not find accessibilityId: ${selector} `);
    }

    await this.setValueImmediate(text, element.ELEMENT);
  }

  public async getAttribute(attribute: string, elementId: string): Promise<string> {
    return this.toShared().getAttribute(attribute, elementId);
  }

  public async disappearRadioButtonSelected(timeOption: DMTimeOption) {
    try {
      const radioButton = await this.findElementByXPath(`//*[./*[@name='${timeOption}']]/*[2]`);

      const attr = await this.getAttribute("value", radioButton.ELEMENT);
      if (attr === "selected") {
        console.log("Great success - default time is correct");
      } else {
        throw new Error("Dammit - default time was not correct");
      }
    } catch (e) {
      console.log(`Couldn't find radioButton ${timeOption}`);
    }
  }

  public async sendImage(platform: SupportedPlatformsType, message?: string, community?: boolean) {
    if (platform === "ios") {
      const ronSwansonBirthday = "196705060700.00";
      await this.clickOnElement("Attachments button");
      await sleepFor(5000);
      await clickOnCoordinates(this.device, InteractionPoints.ImagesFolderKeyboardClosed);
      const permissions = await this.doesElementExist({
        strategy: "accessibility id",
        selector: "Allow Full Access",
        maxWait: 1000,
      });
      if (permissions) {
        try {
          await this.clickOnElement(`Allow Full Access`);
        } catch (e) {
          console.log("No permissions dialog");
        }
      } else {
        console.log("No permissions dialog");
      }
      const testImage = await this.doesElementExist({
        strategy: "accessibility id",
        selector: `1967-05-05 21:00:00 +0000`,
        maxWait: 2000,
      });
      if (!testImage) {
        await runScriptAndLog(`touch -a -m -t ${ronSwansonBirthday} 'run/test/specs/media/test_image.jpg'`);

        await runScriptAndLog(
          `xcrun simctl addmedia ${getIosFirstSimulator() || ""} 'run/test/specs/media/test_image.jpg'`,
          true
        );
      }
      await sleepFor(100);
      await this.clickOnElement(`1967-05-05 21:00:00 +0000`);
      if (message) {
        await this.clickOnElement("Text input box");
        await this.inputText("accessibility id", "Text input box", message);
      }
      await this.clickOnElement("Send button");
      await this.waitForTextElementToBePresent({
        strategy: "accessibility id",
        selector: "Message sent status: Sent",
        maxWait: 50000,
      });
    } else {
      await this.clickOnElement("Attachments button");
      await sleepFor(100);
      await this.clickOnElement("Documents folder");
      await this.clickOnElement("Show roots");
      await sleepFor(100);
      await this.clickOnTextElementById(`android:id/title`, "Downloads");
      await sleepFor(100);
      const testImage = await this.doesElementExist({
        strategy: "id",
        selector: "android:id/title",
        maxWait: 2000,
        text: "test_image.jpg",
      });
      if (!testImage) {
        await runScriptAndLog(
          `adb -s emulator-5554 push 'run/test/specs/media/test_image.jpg' /storage/emulated/0/Download`,
          true
        );
      }
      await sleepFor(100);
      await this.clickOnTextElementById("android:id/title", "test_image.jpg");
      if (community) {
        await this.scrollToBottom(platform);
      }
      await this.waitForTextElementToBePresent({
        strategy: "accessibility id",
        selector: `Message sent status: Sent`,
        maxWait: 50000,
      });
    }
  }

  public async sendVideo(platform: SupportedPlatformsType) {
    if (platform === "android") {
      // Click on attachments button
      await this.clickOnElement("Attachments button");
      await sleepFor(100);
      // Select images button/tab
      await this.clickOnElement("Documents folder");
      await sleepFor(200);
      // Select video
      const mediaButtons = await this.findElementsByClass("android.widget.Button");
      const videosButton = await this.findMatchingTextInElementArray(mediaButtons, "Videos");
      if (!videosButton) {
        throw new Error("videosButton was not found");
      }
      await this.click(videosButton.ELEMENT);
      const testVideo = await this.doesElementExist({
        strategy: "id",
        selector: "android:id/title",
        maxWait: 1000,
        text: "test_video.mp4",
      });
      if (!testVideo) {
        // Adds video to downloads folder if it isn't already there
        await runScriptAndLog(
          `adb -s emulator-5554 push 'run/test/specs/media/test_video.mp4' /storage/emulated/0/Download`,
          true
        );
      }
      await sleepFor(100);
      await this.clickOnTextElementById("android:id/title", "test_video.mp4");
      await this.waitForTextElementToBePresent({
        strategy: "accessibility id",
        selector: `Message sent status: Sent`,
        maxWait: 50000,
      });
    }
  }

  // ACTIONS
  public async swipeLeftAny(selector: AccessibilityId) {
    const el = await this.waitForTextElementToBePresent({
      strategy: "accessibility id",
      selector,
    });

    const loc = await this.getElementRect(el.ELEMENT);
    console.log(loc);

    if (!loc) {
      throw new Error("did not find element rectangle");
    }
    await this.scroll(
      { x: loc.x + loc.width, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width / 2, y: loc.y + loc.height / 2 },
      1000
    );

    console.warn("Swiped left on ", selector);
  }

  public async swipeLeft(accessibilityId: AccessibilityId, text: string) {
    const el = await this.findMatchingTextAndAccessibilityId(accessibilityId, text);

    const loc = await this.getElementRect(el.ELEMENT);
    console.log(loc);

    if (!loc) {
      throw new Error("did not find element rectangle");
    }
    await this.scroll(
      { x: loc.x + loc.width, y: loc.y + loc.height / 2 },
      { x: loc.x + loc.width / 2, y: loc.y + loc.height / 2 },
      1000
    );

    console.warn("Swiped left on ", el);
    // let some time for swipe action to happen and UI to update
  }

  public async scrollDown() {
    await this.scroll({ x: 760, y: 1500 }, { x: 760, y: 710 }, 100);
  }

  public async scrollToBottom(platform: SupportedPlatformsType) {
    if (platform === "android") {
      await this.clickOnElementAll({
        strategy: "id",
        selector: "network.loki.messenger:id/scrollToBottomButton",
      });
    } else {
      await this.clickOnElementAll({
        strategy: "accessibility id",
        selector: "Scroll button",
      });
    }
  }

  public async navigateBack(platform: SupportedPlatformsType) {
    if (platform === "ios") {
      await this.clickOnElement("Back");
    } else {
      await this.clickOnElement("Navigate up");
    }
  }

  /* ======= Settings functions =========*/

  public async turnOnReadReceipts(platform: SupportedPlatformsType) {
    if (platform === "android") {
      await this.navigateBack(platform);
      await sleepFor(100);
      await this.clickOnElement("User settings");
      await sleepFor(500);
      await this.clickOnElementById(`network.loki.messenger:id/privacyButton`);
      await sleepFor(2000);
      await this.clickOnElementAll({
        strategy: "id",
        selector: "android:id/summary",
        text: "Send read receipts in one-to-one chats.",
      });
      await this.navigateBack(platform);
      await sleepFor(100);
      await this.navigateBack(platform);
    } else {
      await this.navigateBack(platform);
      await sleepFor(100);
      await this.clickOnElement("User settings");
      await this.clickOnElementAll({ strategy: "id", selector: "Privacy" });
      await this.clickOnElementAll({
        strategy: "xpath",
        selector: `//XCUIElementTypeSwitch[@name="Read Receipts, Send read receipts in one-to-one chats."]`,
      });
      await this.navigateBack(platform);
      await sleepFor(100);
      await this.clickOnElement("Close button");
    }
  }

  /* === all the utilities function ===  */
  private isIOS(): boolean {
    return isDeviceIOS(this.device);
  }

  private isAndroid(): boolean {
    return isDeviceAndroid(this.device);
  }

  private toIOS(): IOSDeviceInterface {
    if (!this.isIOS()) {
      throw new Error("Not an ios device");
    }
    return this.device as unknown as IOSDeviceInterface;
  }

  private toAndroid(): AndroidDeviceInterface {
    if (!this.isAndroid()) {
      throw new Error("Not an android device");
    }
    return this.device as unknown as AndroidDeviceInterface;
  }

  private toShared(): SharedDeviceInterface {
    return this.device as unknown as SharedDeviceInterface;
  }
}
