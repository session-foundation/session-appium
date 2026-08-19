// Not a port — the desktop client wrapper written for this repo. Its low-level primitives
// delegate to the ported run/desktop/ helpers (which are compared against their originals).
import type { Page } from '@playwright/test';
import type { StateUser, UserNameType } from '@session-foundation/qa-seeder';

import type { IBaseDeviceWrapper } from '../types/IBaseDeviceWrapper';
import type {
  DataTestId,
  DisappearOptions,
  Group,
  MediaType,
  MessageStatus,
  ModalId,
  StrategyExtractionObj,
} from './types';

import { tStripped } from '../localizer/lib';
import { makeAccountPro } from '../shared/pro_grant';
import { sleepFor } from '../shared/promise_utils';
import { parseDataImage } from '../test/utils/check_colour';
import { proFeatureTestId, type ProMessageFeature } from '../test/utils/pro_message_features';
import { ctaConfigs, type CTAType } from '../types/cta';
import {
  openConversationWith as desktopOpenConversationWith,
  scrollToBottomLookingForMessage,
} from './conversation';
import { createContact } from './create_contact';
import { joinCommunity, joinOrOpenCommunity } from './join_community';
import { leaveGroup } from './leave_group';
import { Conversation, CTA, HomeScreen, LeftPane, ProSettings, Settings } from './locators';
import {
  confirmMessageDeletedFor,
  deleteMessageFor,
  sendMessage as desktopSendMessage,
  type MessageDeleteType,
  waitForMessageStatus,
} from './message';
import { newUser } from './new_user';
import { recoverFromSeed } from './recovery_using_seed';
import { renameGroup } from './rename_group';
import { replyTo, replyToMedia } from './reply_message';
import { sendLinkPreview, sendMedia, sendVoiceMessage, trustUser } from './send_media';
import { sendNewMessage } from './send_message';
import { setDisappearingMessages } from './set_disappearing_messages';
import {
  checkCTAStrings,
  checkModalStrings,
  checkPathLight,
  clickOn,
  clickOnElement,
  clickOnMatchingText,
  clickOnTextMessage,
  clickOnWithText,
  doWhileWithMax,
  hasElementPoppedUpThatShouldnt,
  measureSendingTime,
  pasteIntoInput,
  rightClickOnWithText,
  scrollToBottomIfNecessary,
  waitForElement,
  waitForLoadingAnimationToFinish,
  waitForMatchingPlaceholder,
  waitForMatchingText,
  waitForTestIdWithText,
  waitForTextMessage,
} from './utils';
import { makeVoiceCall } from './voice_call';

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
  private page: Page;
  private deviceIdentity: string;
  private account?: StateUser;
  private launch?: { multi: string; nodeAppInstance: string };

  constructor(page: Page, identity: string = 'desktop') {
    this.page = page;
    this.deviceIdentity = identity;
  }

  /**
   * Record what this window was launched with, so it can be brought back up on the same user-data
   * directory. Set by the test template; without it `restartApp` has nothing to restore to.
   */
  public setLaunchIdentity(multi: string, nodeAppInstance: string): void {
    this.launch = { multi, nodeAppInstance };
  }

  public getLaunchIdentity(): { multi: string; nodeAppInstance: string } {
    if (!this.launch) {
      throw new Error(
        `[${this.deviceIdentity}] has no launch identity, so it cannot be restarted. Only windows ` +
          `opened by the test template carry one.`
      );
    }
    return this.launch;
  }

  /** Point this wrapper at the window a restart produced. */
  public setPage(page: Page): void {
    this.page = page;
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
  public getUser(): StateUser {
    if (!this.account) {
      throw new Error(`[${this.deviceIdentity}] has no account yet (call onboard() first)`);
    }
    return this.account;
  }

  /** Record which account this client is signed into (e.g. a linked/second window). */
  public setAccount(account: StateUser): void {
    this.account = account;
  }

  public get userName(): string {
    return this.getUser().userName;
  }

  public get accountId(): string {
    return this.getUser().sessionId;
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

  /**
   * Restore this window onto an existing account from its recovery phrase.
   *
   * Being prompted for a display name means the profile was not found on the network, and by default
   * that THROWS — for a seeded account it means the seeder did not push its config, which is worth
   * failing on rather than typing past.
   *
   * `fallbackName` is the explicit opt-out, for the one case where the prompt is expected and harmless:
   * an account created moments earlier, whose profile has not propagated yet, in a spec that asserts
   * something other than the name. Supplying it is a statement that the name is not under test.
   */
  public async restoreFromSeed(seedPhrase: string, fallbackName?: string): Promise<void> {
    await recoverFromSeed(this.page, seedPhrase, fallbackName ? { fallbackName } : undefined);
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

  /**
   * Grant this client's account Pro against the QA backend, through the same mint the mobile
   * wrappers use.
   *
   * `provider` is passed explicitly because there is no platform to derive one from. Which store the
   * payment claims to come from does not affect the entitlement — the grant binds to the master key
   * derived from the recovery phrase.
   *
   * Pro is **not** active when this returns: the client reconciles it on its next authenticated
   * request, so callers must retry rather than assert immediately.
   */
  public async subscribeToPro(): Promise<void> {
    const account = this.getUser();
    await makeAccountPro({
      user: {
        userName: account.userName,
        sessionId: account.sessionId,
        seedPhrase: account.seedPhrase,
      },
      provider: 'google',
    });
  }

  /**
   * Block until this client has reconciled a Pro grant, by reopening the Pro settings page until it
   * shows the active-plan sections.
   *
   * Reopening is the point, not polling one rendered screen: the page fetches status when it opens,
   * so a screen left open can sit on a pre-grant answer indefinitely.
   */
  public async waitForProActive(maxWaitMs = 60_000): Promise<void> {
    await doWhileWithMax(maxWaitMs, 1_000, 'waiting for the Pro grant to reconcile', async () => {
      try {
        await clickOn(this.page, LeftPane.settingsButton);
        await clickOn(this.page, Settings.proMenuItem);
        await waitForElement({
          window: this.page,
          locator: ProSettings.statsHeader,
          options: { maxWaitMs: 2_000 },
        });
        return true;
      } catch (e) {
        this.log(`Pro not active yet: ${(e as Error).message.split('\n')[0]}`);
        return false;
      } finally {
        // Closed through the modal's own button, not Escape: a modal left open swallows the next
        // iteration's click on the settings button, which turns a slow grant into an infinite one.
        await clickOnElement({
          window: this.page,
          strategy: 'data-testid',
          selector: 'modal-close-button',
        }).catch(() => undefined);
      }
    });
  }

  /**
   * Set this account's display picture from whatever the test-integration picker is configured to
   * return (`fakeAvatarPickerFile`), leaving the app back on the home screen.
   *
   * Returns without saving when a CTA intercepts the upload — a non-Pro account picking an animated
   * image gets the upsell instead, which is a case the caller asserts rather than an error here.
   */
  public async uploadProfilePicture(): Promise<void> {
    await clickOn(this.page, LeftPane.profileButton);
    await clickOn(this.page, Settings.displayName);
    await clickOn(this.page, Settings.imageUploadSection);
    await clickOn(this.page, Settings.imageUploadClick);

    // Wait for the PREVIEW, not for the Save button. Save reports itself enabled before the picked
    // image has been processed, and `handleUpload` then returns silently on `!avatarChanged` — so an
    // early click is swallowed, the image finishes processing a moment later, and nothing clicks
    // again. The preview appearing is the only signal that Save will actually do something.
    await this.page
      .getByTestId(Settings.editProfilePicturePreview.selector)
      .waitFor({ state: 'visible', timeout: 60_000 });

    await clickOn(this.page, Settings.saveProfileUpdateButton);

    // A non-Pro account picking an animated image gets the upsell CTA instead of an upload, and the
    // caller asserts that — so this has to distinguish the two outcomes.
    //
    // RACED rather than waited on with a timeout. The CTA is dispatched through redux so it is
    // briefly absent after the click and cannot simply be sampled; but a fixed wait costs its full
    // duration on every Pro account, where no CTA can ever arrive. The display-picture dialog
    // closing is the opposite outcome, so whichever resolves first says which path this is.
    const ctaShown = this.page
      .getByTestId(CTA.heading.selector)
      .waitFor({ state: 'visible', timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
    const pictureSaved = this.page
      .getByTestId(Settings.editProfilePictureProBadge.selector)
      .waitFor({ state: 'detached', timeout: 60_000 })
      .then(() => false)
      .catch(() => false);

    if (await Promise.race([ctaShown, pictureSaved])) {
      return;
    }

    // Dismissed immediately rather than waited on. `save-button-profile-update` is carried by the
    // profile-info dialog's Save as well as this one, so waiting for it to detach waits for a dialog
    // we are about to dismiss ourselves. The picture is already committed by the display-picture
    // dialog's own Save and the name was never touched, so whichever control is on offer beneath
    // discards nothing.
    await this.closeOpenModals();
  }

  /**
   * Dismiss every open modal, topmost first.
   *
   * Scoped to the topmost dialog rather than the page: these nest, several carry
   * `modal-close-button`, and a page-wide match resolves to the OUTERMOST one — which sits under the
   * stack and cannot be clicked, so the attempt burns a timeout before being discarded.
   *
   * Three controls, in this order, because a dialog may offer only one of them and the right choice
   * changes with state: "Update Profile Information" has no close button, and shows **Cancel** until
   * something changes and **Save** afterwards — so an avatar upload leaves it wanting Save, while an
   * untouched visit wants Cancel. Both are safe here: the display picture is already committed by the
   * Set Display Picture dialog's own Save before this runs.
   */
  private async closeOpenModals(): Promise<void> {
    const dialogs = this.page.getByRole('dialog');
    for (let guard = 0; guard < 5; guard++) {
      const open = await dialogs.count();
      if (open === 0) {
        return;
      }
      const topmost = dialogs.nth(open - 1);
      const candidates = [
        topmost.getByTestId('modal-close-button'),
        topmost.getByRole('button', { name: tStripped('save'), exact: true }),
        topmost.getByRole('button', { name: tStripped('cancel'), exact: true }),
      ];
      let dismissed = false;
      for (const candidate of candidates) {
        if (await candidate.count()) {
          // Short: a dismissal that misses should cost a retry, not the 30s default.
          await candidate
            .first()
            .click({ timeout: 5_000 })
            .catch(() => undefined);
          dismissed = true;
          break;
        }
      }
      if (!dismissed) {
        throw new Error(
          `[${this.deviceIdentity}] cannot dismiss "${(await topmost.innerText())
            .replace(/\s+/g, ' ')
            .slice(0, 60)}" — it offers no close, save or cancel control.`
        );
      }
    }
  }

  /**
   * Turn this account's Pro badge on, leaving the app back on the home screen.
   *
   * **Being Pro is not the same as advertising it** — badge visibility is a separate per-user setting
   * and is off by default, so any spec asserting that someone *else* can see a badge has to call this.
   *
   * The ROW is clicked, never the toggle: every settings toggle sits in a `pointer-events: none`
   * container so the row handles the click once instead of twice. A click aimed at the toggle falls
   * through and Playwright blames whatever is behind it, which reads as an overlay bug.
   */
  public async enableProBadge(): Promise<void> {
    await clickOn(this.page, LeftPane.settingsButton);
    await clickOn(this.page, Settings.proMenuItem);

    const toggle = this.page.getByTestId(ProSettings.badgeToggle.selector);
    if ((await toggle.getAttribute('data-active')) !== 'true') {
      await clickOn(this.page, ProSettings.badgeRow);
    }
    // The click writes the flag to libSession and re-renders off the result, so the attribute lags
    // the click. Polled rather than read once, or this reports a failure that fixes itself.
    let state: string | null = null;
    await doWhileWithMax(10_000, 250, 'waiting for the Pro badge toggle', async () => {
      state = await toggle.getAttribute('data-active');
      return state === 'true';
    }).catch(() => undefined);
    if (state !== 'true') {
      throw new Error(
        `Pro badge toggle is still off (data-active=${state}) after being set. Without it this ` +
          `account advertises no badge, and any later badge assertion fails as though the feature ` +
          `were broken.`
      );
    }

    await this.closeOpenModals();
  }

  /**
   * Block until this client knows it has Pro, WITHOUT asking the backend.
   *
   * For the client that did not subscribe: Pro reaches it through config sync — the proof and the
   * badge bit live in the same user config object — so nothing here needs to talk to the Pro backend.
   *
   * **It deliberately never opens the Pro page.** `ProSettingsPage` does `useMount(() => refetch())`,
   * so every visit fires `get_pro_status` for THIS account from THIS client. Polling that page once a
   * second, as the previous version of this did, made a linked device a second client minting against
   * the same account for as long as the wait ran — and the subscribing client's proof is the one the
   * spec is testing. Only the client that subscribed should ever reach that screen.
   *
   * The badge beside our own name on the settings root is the fetch-free substitute. For ourselves it
   * is driven by our own Pro status (`useProBadgeOnClickCb`'s `show-our-profile-dialog` branch), not by
   * the badge-visibility flag — so it says "Pro has landed here", which is the precondition
   * `sendLongProMessage` needs. It does not prove the badge bit itself has synced; that rides the same
   * config, and the send retry below is what absorbs the remaining ordering.
   */
  public async waitForOwnProBadge(maxWaitMs = 60_000): Promise<void> {
    await doWhileWithMax(maxWaitMs, 1_000, 'waiting for Pro to sync to this client', async () => {
      try {
        await clickOn(this.page, LeftPane.settingsButton);
        await waitForElement({
          window: this.page,
          locator: Settings.ownProBadge,
          options: { maxWaitMs: 2_000 },
        });
        return true;
      } catch (e) {
        this.log(`Pro has not synced here yet: ${(e as Error).message.split('\n')[0]}`);
        return false;
      } finally {
        // Closed between attempts, or the open dialog swallows the next iteration's click on the
        // settings button and a slow sync becomes an infinite one.
        await this.closeOpenModals().catch(() => undefined);
      }
    });
  }

  /**
   * Open the edit-profile-picture modal and click its Pro badge, which is what raises the
   * animated-display-picture CTA — activated for a subscriber, the upsell otherwise.
   */
  public async openAnimatedDisplayPictureCTA(): Promise<void> {
    await clickOn(this.page, LeftPane.profileButton);
    await clickOn(this.page, Settings.displayName);
    await clickOn(this.page, Settings.imageUploadSection);
    await clickOn(this.page, Settings.editProfilePictureProBadge);
  }

  public async assertProFeatureUnlocked(user: Pick<StateUser, 'sessionId'>): Promise<void> {
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
        await sendNewMessage(this.page, user.sessionId, message);
        await waitForTextMessage(this.page, message);
        return true;
      } catch (_e) {
        await this.page.keyboard.press('Escape').catch(() => undefined);
        return false;
      }
    });
  }

  /** Wait until a message with exactly this text is present in the open conversation. */
  public async waitForMessage(text: string, maxWaitMs?: number): Promise<void> {
    await waitForTextMessage(this.page, text, maxWaitMs);
  }

  /**
   * Open `convoName` and send a >2000-char message, retrying until it is accepted.
   * A non-Pro account's send is blocked by the "longer messages" upgrade CTA, so the
   * 'sent' status never arrives; between attempts we press Escape to clear any CTA and
   * re-open the conversation. Proves this device has Pro active without an app restart.
   */
  public async sendLongProMessage(
    convoName: string,
    message: string,
    maxWaitMs = 60_000
  ): Promise<void> {
    await doWhileWithMax(
      maxWaitMs,
      1_000,
      `sendLongProMessage ${this.deviceIdentity}`,
      async () => {
        try {
          await this.openConversationWith(convoName);
          await desktopSendMessage(this.page, message);
          await waitForTextMessage(this.page, message);
          return true;
        } catch (_e) {
          await this.page.keyboard.press('Escape').catch(() => undefined);
          return false;
        }
      }
    );
  }

  // --- Receiver-side Session Pro assertions ---
  // Used when this client observes a PEER's Pro state. `assertSenderProBadge` is on
  // IBaseDeviceWrapper — mobile satisfies the same signature — so a cross-platform spec can
  // assert it over every client regardless of platform. The animation checks below are still
  // desktop-only: mobile's equivalent (verifyElementIsAnimated) takes an Appium locator, so
  // there is no shared signature to promote yet.

  /** Center-pixel hex color of the first element matching `cssSelector` (via screenshot). */
  private async sampleCenterColor(cssSelector: string): Promise<string> {
    const buffer = await this.page.locator(cssSelector).first().screenshot();
    return parseDataImage(buffer.toString('base64'));
  }

  /**
   * Assert an element is animated by sampling its center pixel `SAMPLE_SIZE` times: an
   * animated (GIF/APNG) image cycles frames, so more than one unique color appears. The
   * whole sampling loop retries within `maxWaitMs` to allow the image to propagate.
   */
  public async verifyElementIsAnimated(cssSelector: string, maxWaitMs = 30_000): Promise<void> {
    const SAMPLE_SIZE = 3;
    await doWhileWithMax(maxWaitMs, 1_000, `verifyElementIsAnimated ${cssSelector}`, async () => {
      const colors = new Set<string>();
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        colors.add(await this.sampleCenterColor(cssSelector));
        await sleepFor(250);
      }
      return colors.size > 1;
    });
  }

  /** Verify THIS account's own avatar (left pane) is animated — e.g. after it synced here. */
  public async verifyOwnAvatarAnimated(): Promise<void> {
    await this.verifyElementIsAnimated('[data-testid="leftpane-primary-avatar"] img');
  }

  /**
   * Open a conversation with a peer once their DISPLAY NAME is showing for it.
   *
   * A conversation this client created itself — by sending first, as `createContact` does — is
   * labelled with the peer's account ID until their profile arrives, which rides along with a
   * message rather than with the contact. Opening by name before then finds nothing, intermittently,
   * so every assertion that addresses a peer by name has to wait for the name first.
   */
  private async openConversationOnceNamed(convoName: string): Promise<void> {
    await waitForTestIdWithText(
      this.page,
      HomeScreen.conversationItemName.selector,
      convoName,
      60_000
    );
    await this.openConversationWith(convoName);
  }

  /** Open `convoName` and verify the peer's conversation-header avatar is animated. */
  public async verifySenderAvatarAnimated(convoName: string): Promise<void> {
    await this.openConversationOnceNamed(convoName);
    await this.verifyElementIsAnimated('[data-testid="conversation-options-avatar"] img');
  }

  /**
   * Open a message's info panel (right-click → Info) and assert it lists the Pro features the message
   * was sent with.
   *
   * The sharpest receiver-side Pro assertion available: the features travel *in the message* as a
   * bitset, so this names what this particular message carried rather than what the sender's profile
   * currently claims. A badge elsewhere only says "this person is Pro".
   *
   * The rows are matched by the test id all three clients now tag them with (`proFeatureTestId`),
   * which is also what lets this name *which* features to expect rather than counting rows.
   */
  public async assertMessageProFeatures(
    message: string,
    features: ProMessageFeature[]
  ): Promise<void> {
    await this.rightClickOnWithText(Conversation.messageContent, message);
    // The menu item carries no test id, only its label.
    await clickOnMatchingText(this.page, tStripped('info'));

    // Waited on together: the rows render as one list, so there is no order to respect, and a missing
    // feature costs one timeout instead of one per feature that follows it. Safe here in a way it is
    // not on mobile — these are independent browser-side polls on one page, whereas Appium serialises
    // commands per session.
    await Promise.all(
      features.map(feature =>
        waitForElement({
          window: this.page,
          locator: { strategy: 'data-testid', selector: proFeatureTestId(feature) },
          options: { maxWaitMs: 10_000 },
        })
      )
    );

    // `Escape` is the panel's own close shortcut (`KbdShortcut.closeRightPanel`). Left open it covers
    // the conversation, so anything the spec does next fails on an element it cannot reach.
    await this.page.keyboard.press('Escape').catch(() => undefined);
  }

  /** Open `convoName` and assert the peer's Session Pro badge shows in the header (polls). */
  public async assertSenderProBadge(convoName: string): Promise<void> {
    await this.openConversationOnceNamed(convoName);
    await doWhileWithMax(60_000, 1_000, `assertSenderProBadge ${convoName}`, async () => {
      try {
        await waitForElement({
          window: this.page,
          locator: Conversation.proBadgeConversationHeader,
          options: { maxWaitMs: 2_000 },
        });
        return true;
      } catch (_e) {
        return false;
      }
    });
  }

  // --- High-level desktop verbs ---
  // These are desktop-only (not on IBaseDeviceWrapper); they delegate to the ported
  // Page-based helpers, passing this client's page/account implicitly.

  /** Onboard a fresh account in this window and remember it as this client's account. */
  public async onboard(userName: UserNameType, awaitOnionPath = true): Promise<StateUser> {
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
    expectedBody: string | undefined,
    expectedButtons: Array<string>,
    expectedFeatures?: Array<string>,
    bodyMatch: 'contains' | 'exact' = 'exact'
  ): Promise<void> {
    await checkCTAStrings(
      this.page,
      expectedHeading,
      expectedBody,
      expectedButtons,
      expectedFeatures,
      bodyMatch
    );
  }

  /**
   * Assert a Session Pro CTA by its kind, using the cross-platform CTA config table
   * (`run/types/cta.ts`, shared with the mobile suite). Resolves the expected heading/body/
   * buttons/features for `type` and delegates to {@link checkCTAStrings}. Prefer this over
   * inlining `tStripped(...)` strings so both platforms share one source of CTA expectations.
   */
  public async checkCTA(type: CTAType): Promise<void> {
    const config = ctaConfigs[type];
    // checkCTAStrings reads buttons positionally: [0] = confirm, [1] = cancel — so a CTA with only a
    // negative button (`alreadyActivated`) must not be collapsed into slot 0, or its Close is
    // asserted against a confirm button that does not exist.
    const buttons = config.positiveButton
      ? [config.positiveButton, ...(config.negativeButton ? [config.negativeButton] : [])]
      : [];
    if (!config.positiveButton && config.negativeButton) {
      await this.checkCTAStrings(config.heading, config.body, buttons, config.features, 'contains');
      await this.waitForElement({
        locator: CTA.cancelButton,
        options: { text: config.negativeButton },
      });
      return;
    }
    // The shared table records the sentence that distinguishes one CTA from another, because iOS
    // splits the body around inline images into several `cta-body` elements and matches whichever
    // one fits. Desktop renders the whole body as a single node, so some variants carry a lead-in
    // ("You've already got PRO") ahead of that sentence — hence contains rather than equals.
    await this.checkCTAStrings(config.heading, config.body, buttons, config.features, 'contains');
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

  public async waitForMatchingText(text: string, maxWait: number): Promise<void> {
    await waitForMatchingText(this.page, text, maxWait);
  }

  public async waitForMatchingPlaceholder(
    dataTestId: DataTestId,
    placeholder: string,
    maxWait?: number
  ): Promise<void> {
    await waitForMatchingPlaceholder(this.page, dataTestId, placeholder, maxWait);
  }

  /** Returns immediately if the loader never shows — see the helper for why that is a pass. */
  public async waitForLoadingAnimationToFinish(
    loader: DataTestId,
    appearWithinMs?: number,
    finishWithinMs?: number
  ): Promise<void> {
    await waitForLoadingAnimationToFinish(this.page, loader, appearWithinMs, finishWithinMs);
  }

  public async clickOnTextMessage(
    text: string,
    rightButton?: boolean,
    maxWait?: number
  ): Promise<void> {
    await clickOnTextMessage(this.page, text, rightButton, maxWait);
  }

  public async rightClickOnWithText(locator: StrategyExtractionObj, text: string): Promise<void> {
    await rightClickOnWithText(this.page, locator, text);
  }

  public async scrollToBottomIfNecessary(): Promise<void> {
    await scrollToBottomIfNecessary(this.page);
  }

  public async scrollToBottomLookingForMessage(msg: string): Promise<void> {
    await scrollToBottomLookingForMessage({ window: this.page, msg });
  }

  public async measureSendingTime(messageNumber: number): Promise<number> {
    return measureSendingTime(this.page, messageNumber);
  }

  // --- Messaging / deletion ---

  public async waitForMessageStatus(message: string, status: MessageStatus): Promise<void> {
    await waitForMessageStatus(this.page, message, status);
  }

  public async deleteMessageFor(message: string, deletionType: MessageDeleteType): Promise<void> {
    await deleteMessageFor(this.page, message, deletionType);
  }

  /** Confirm a delete propagated as expected. `this` is the window that initiated the delete. */
  public async confirmMessageDeletedFor(args: {
    deleteType: MessageDeleteType;
    messageToDelete: string;
    otherWindows: DesktopWrapper[];
  }): Promise<void> {
    await confirmMessageDeletedFor({
      deleteType: args.deleteType,
      messageToDelete: args.messageToDelete,
      windowInitiatingDelete: this.page,
      otherWindows: args.otherWindows.map(w => w.getPage()),
    });
  }

  // --- Reply ---

  /** Reply to a text message. `this` is the sender; `to` receives (null skips the receipt wait). */
  public async replyTo(args: {
    textMessage: string;
    replyText: string;
    to: DesktopWrapper | null;
    shouldCheckMediaPreview?: boolean;
  }): Promise<void> {
    await replyTo({
      senderWindow: this.page,
      textMessage: args.textMessage,
      replyText: args.replyText,
      receiverWindow: args.to ? args.to.getPage() : null,
      shouldCheckMediaPreview: args.shouldCheckMediaPreview,
    });
  }

  public async replyToMedia(args: {
    replyText: string;
    locator: StrategyExtractionObj;
    to: DesktopWrapper;
  }): Promise<void> {
    await replyToMedia({
      senderWindow: this.page,
      replyText: args.replyText,
      locator: args.locator,
      receiverWindow: args.to.getPage(),
    });
  }

  // --- Media ---

  public async sendMedia(
    path: string,
    message: string,
    shouldCheckMediaPreview: boolean = false
  ): Promise<void> {
    await sendMedia(this.page, path, message, shouldCheckMediaPreview);
  }

  public async sendVoiceMessage(): Promise<void> {
    await sendVoiceMessage(this.page);
  }

  public async sendLinkPreview(link: string): Promise<void> {
    await sendLinkPreview(this.page, link);
  }

  public async trustUser(mediaType: MediaType, userName: string): Promise<void> {
    await trustUser(this.page, mediaType, userName);
  }

  // --- Communities / groups ---

  public async joinCommunity(): Promise<void> {
    await joinCommunity(this.page);
  }

  public async joinOrOpenCommunity(): Promise<void> {
    await joinOrOpenCommunity(this.page);
  }

  public async leaveGroup(group: Group): Promise<void> {
    await leaveGroup(this.page, group);
  }

  public async renameGroup(oldGroupName: string, newGroupName: string): Promise<void> {
    await renameGroup(this.page, oldGroupName, newGroupName);
  }

  // --- Disappearing messages ---

  public async setDisappearingMessages(
    options: DisappearOptions,
    other?: DesktopWrapper
  ): Promise<void> {
    await setDisappearingMessages(this.page, options, other?.getPage());
  }

  // --- Voice / video calls ---

  /** Place a voice call from this client to `receiver`. */
  public async makeVoiceCallTo(receiver: DesktopWrapper): Promise<void> {
    await makeVoiceCall(this.page, receiver.getPage());
  }
}
