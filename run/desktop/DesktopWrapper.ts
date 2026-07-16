import type { Page } from '@playwright/test';

import type { IBaseDeviceWrapper } from '../types/IBaseDeviceWrapper';
import type { User } from '../types/testing';
import type { DataTestId, User as DesktopUser, ModalId, StrategyExtractionObj } from './types';

import { tStripped } from '../localizer/lib';
import { makeAccountPro } from '../test/utils/mock_pro';
import { openConversationWith as desktopOpenConversationWith } from './conversation';
import { createContact } from './create_contact';
import { LeftPane, Settings } from './locators';
import { sendMessage as desktopSendMessage } from './message';
import { newUser } from './new_user';
import { recoverFromSeed } from './recovery_using_seed';
import { sendNewMessage } from './send_message';
import {
  checkCTAStrings,
  checkModalStrings,
  checkPathLight,
  clickOn,
  clickOnElement,
  clickOnMatchingText,
  clickOnWithText,
  doWhileWithMax,
  hasElementPoppedUpThatShouldnt,
  pasteIntoInput,
  waitForElement,
  waitForTestIdWithText,
  waitForTextMessage,
} from './utils';

/**
 * Desktop (Session Desktop / Electron) client implementing the cross-platform
 * {@link IBaseDeviceWrapper} contract by driving a Playwright `Page`.
 *
 * This is a pure behaviour adapter: the `Page` (Electron window) is created and
 * torn down by the cross-platform test template (`crossPlatformTest`), which owns
 * the Electron process lifecycle — it resets the tracked pids on start and calls
 * `forceCloseAllWindows` on finally so respawned windows are killed too. The
 * wrapper itself never launches or force-kills Electron.
 *
 * Only the universal verbs are implemented — the mobile-only members
 * (`assertProActive`, the CTA/modal helpers, ...) live on `IMobileWrapper` and
 * are intentionally NOT part of this class. Pro sync is proven functionally via
 * `assertProFeatureUnlocked` (desktop has no "Pro Activated" settings surface yet).
 */
export class DesktopWrapper implements IBaseDeviceWrapper {
  private readonly page: Page;
  private deviceIdentity: string;
  private account?: DesktopUser;

  constructor(page: Page, identity: string = 'desktop') {
    this.page = page;
    this.deviceIdentity = identity;
  }

  // --- Escape hatch + account accessors ---

  /**
   * The underlying Playwright `Page`. Prefer the wrapper's verbs; reach for this
   * only for the rare low-level interaction that has no method yet.
   */
  public getPage(): Page {
    return this.page;
  }

  /** The account minted/linked on this client, if any. Throws if none yet. */
  public getUser(): DesktopUser {
    if (!this.account) {
      throw new Error(`[${this.deviceIdentity}] has no account yet (call onboard() first)`);
    }
    return this.account;
  }

  public get userName(): string {
    return this.getUser().userName;
  }

  public get accountId(): string {
    return this.getUser().accountid;
  }

  // --- IBaseDeviceWrapper: logging ---

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

  // --- IBaseDeviceWrapper: identity / lifecycle ---

  public setDeviceIdentity(identity: string): void {
    this.deviceIdentity = identity;
  }

  public getDeviceIdentity(): string {
    return this.deviceIdentity;
  }

  /**
   * Close this client's window (best effort). Full Electron process-tree cleanup
   * (including respawned windows) is handled by the test template's
   * `forceCloseAllWindows`, so this only closes the tracked page.
   */
  public async deleteSession(): Promise<void> {
    await this.page.close().catch(() => undefined);
  }

  // --- IBaseDeviceWrapper: account ---

  public async restoreFromSeed(recoveryPhrase: string): Promise<void> {
    await recoverFromSeed(this.page, recoveryPhrase);
    await checkPathLight(this.page);
  }

  // --- IBaseDeviceWrapper: profile ---

  public async changeDisplayName(name: string): Promise<void> {
    await clickOn(this.page, LeftPane.profileButton);
    // Click the name to reveal the edit field.
    await clickOn(this.page, Settings.displayName);
    await pasteIntoInput(this.page, Settings.displayNameInput.selector, name);
    // Confirm the change — desktop has no dedicated save testid here, it's the localized "Save" text.
    await clickOnMatchingText(this.page, tStripped('save'));
    // Close the profile dialog to return to a neutral state.
    await clickOnElement({
      window: this.page,
      strategy: 'data-testid',
      selector: 'modal-close-button',
    });
  }

  public async assertDisplayName(name: string): Promise<void> {
    // Reopen the profile dialog and poll until the (possibly synced) name appears.
    await doWhileWithMax(15_000, 500, 'waiting for updated display name', async () => {
      await clickOn(this.page, LeftPane.profileButton);
      try {
        await waitForTestIdWithText(this.page, Settings.displayName.selector, name, 1_000);
        return true;
      } catch (_e) {
        return false;
      } finally {
        await clickOnElement({
          window: this.page,
          strategy: 'data-testid',
          selector: 'modal-close-button',
        });
      }
    });
  }

  // --- IBaseDeviceWrapper: messaging ---

  public async sendMessage(message: string): Promise<number> {
    await desktopSendMessage(this.page, message);
    return Date.now();
  }

  // --- IBaseDeviceWrapper: Session Pro ---

  public async subscribeToPro(user: User): Promise<void> {
    // Desktop hits the same dev Pro backend; the provider label is cosmetic there.
    await makeAccountPro({ user, provider: 'google' });
  }

  public async assertProFeatureUnlocked(user: Pick<User, 'accountID'>): Promise<void> {
    // A Pro account can send a message longer than the standard 2000-char cap.
    // For a non-Pro account the send is blocked by the "longer messages" upgrade
    // CTA, so the 'sent' status inside sendNewMessage would never arrive.
    const message = 'x'.repeat(2001);
    // Pro status is not necessarily live on this client the instant subscribeToPro
    // returns (backend mock + client propagation is async), so retry the send until
    // it's accepted rather than making a single attempt. Between attempts dismiss any
    // open upgrade CTA / modal (Escape) so the next attempt can re-navigate cleanly.
    await doWhileWithMax(60_000, 1_000, 'assertProFeatureUnlocked', async () => {
      try {
        await sendNewMessage(this.page, user.accountID, message);
        await waitForTextMessage(this.page, message);
        return true;
      } catch (_e) {
        await this.page.keyboard.press('Escape').catch(() => undefined);
        return false;
      }
    });
  }

  // --- High-level desktop verbs ---
  // These are desktop-only (not on IBaseDeviceWrapper); they delegate to the ported
  // Page-based helpers, passing this client's page/account implicitly.

  /** Onboard a fresh account in this window and remember it as this client's account. */
  public async onboard(userName: string, awaitOnionPath = true): Promise<DesktopUser> {
    this.account = await newUser(this.page, userName, awaitOnionPath);
    return this.account;
  }

  /** Make this client and `other` mutual contacts by exchanging a message each way. */
  public async createContactWith(other: DesktopWrapper): Promise<void> {
    await createContact(this.page, other.getPage(), this.getUser(), other.getUser());
  }

  /** Open the conversation whose left-pane name matches `convoName`. */
  public async openConversationWith(convoName: string): Promise<void> {
    await desktopOpenConversationWith(this.page, convoName);
  }

  /** Start a brand-new conversation with `sessionId` and send `message`. */
  public async sendNewMessage(sessionId: string, message: string): Promise<void> {
    await sendNewMessage(this.page, sessionId, message);
  }

  // --- Low-level primitives (mirror the mobile DeviceWrapper's dual nature) ---

  public async clickOn(
    locator: StrategyExtractionObj,
    options?: Parameters<typeof clickOn>[2]
  ): Promise<void> {
    await clickOn(this.page, locator, options);
  }

  public async clickOnWithText(locator: StrategyExtractionObj, text: string): Promise<void> {
    await clickOnWithText(this.page, locator, text);
  }

  public async clickOnElement(
    args: StrategyExtractionObj & { maxWait?: number; rightButton?: boolean }
  ): Promise<void> {
    const { maxWait, rightButton, ...locator } = args;
    await clickOn(this.page, locator as StrategyExtractionObj, { maxWait, rightButton });
  }

  public async clickOnMatchingText(text: string): Promise<void> {
    await clickOnMatchingText(this.page, text);
  }

  public async pasteIntoInput(dataTestId: DataTestId, text: string): Promise<void> {
    await pasteIntoInput(this.page, dataTestId, text);
  }

  public async waitForTextMessage(text: string, maxWait?: number): Promise<void> {
    await waitForTextMessage(this.page, text, maxWait);
  }

  public async waitForTestIdWithText(
    dataTestId: DataTestId,
    text?: string,
    maxWait?: number
  ): Promise<void> {
    await waitForTestIdWithText(this.page, dataTestId, text, maxWait);
  }

  public async waitForElement(
    args: Omit<Parameters<typeof waitForElement>[0], 'window'>
  ): Promise<void> {
    await waitForElement({ window: this.page, ...args });
  }

  public async checkModalStrings(
    expectedHeading: string,
    expectedDescription?: string,
    modalId?: ModalId
  ): Promise<void> {
    await checkModalStrings(this.page, expectedHeading, expectedDescription, modalId);
  }

  public async checkCTAStrings(
    expectedHeading: string,
    expectedBody: string,
    expectedButtons: Array<string>,
    expectedFeatures?: Array<string>
  ): Promise<void> {
    await checkCTAStrings(
      this.page,
      expectedHeading,
      expectedBody,
      expectedButtons,
      expectedFeatures
    );
  }

  public async hasElementPoppedUpThatShouldnt(
    locator: StrategyExtractionObj,
    text?: string
  ): Promise<void> {
    await hasElementPoppedUpThatShouldnt(this.page, locator, text);
  }

  /** Resolve once this client's window closes (e.g. after an onboarding "quit" restart). */
  public async waitForWindowClosed(timeout: number): Promise<void> {
    await this.page.waitForEvent('close', { timeout });
  }
}
