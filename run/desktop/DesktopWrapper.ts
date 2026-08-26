// Not a port — the desktop client wrapper written for this repo. Its low-level primitives
// delegate to the ported run/desktop/ helpers (which are compared against their originals).
import type { Page } from '@playwright/test';
import type { StateUser, UserNameType } from '@session-foundation/qa-seeder';

import { test } from '@playwright/test';

import type { IBaseDeviceWrapper } from '../types/IBaseDeviceWrapper';
import type {
  AttachmentType,
  DataTestId,
  DisappearOptions,
  Group,
  MessageStatus,
  ModalId,
  StrategyExtractionObj,
} from './types';

import { tStripped } from '../localizer/lib';
import { AVATAR_SYNC_MAX_WAIT_MS, GENERATED_AVATAR_COLORS } from '../shared/constants';
import { makeAccountPro } from '../shared/pro_grant';
import { sleepFor } from '../shared/promise_utils';
import { parseDataImage } from '../test/utils/check_colour';
import { proFeatureTestId, type ProMessageFeature } from '../test/utils/pro_message_features';
import {
  MOVABLE_PRO_STATS,
  type MovableProStat,
  parseProStatCount,
  type ProStatCounts,
} from '../test/utils/pro_settings';
import { ctaConfigs, type CTAType } from '../types/cta';
import {
  openConversationWith as desktopOpenConversationWith,
  scrollToBottomLookingForMessage,
} from './conversation';
import { createContact } from './create_contact';
import { joinCommunity, joinCommunityByLink, joinOrOpenCommunity } from './join_community';
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
  buildDescendantSelector,
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
  waitForElementHidden,
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
  /**
   * Mint a real Pro grant for this window's account.
   *
   * `durationSeconds` overrides the plan's nominal length. A tiny value is how the overhang is reached:
   * the account lapses within a second or two, while the signed proof stays valid for the whole coverage
   * window, so the client's next status read sees an expired plan and a live credential together.
   */
  public async subscribeToPro(
    _user?: StateUser,
    options?: { durationSeconds?: number }
  ): Promise<void> {
    const account = this.getUser();
    await makeAccountPro({
      user: {
        userName: account.userName,
        sessionId: account.sessionId,
        seedPhrase: account.seedPhrase,
      },
      provider: 'google',
      ...(options?.durationSeconds === undefined
        ? {}
        : { durationSeconds: options.durationSeconds }),
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
   * Set this account's display picture to the suite's animated GIF (see `IBaseDeviceWrapper`).
   *
   * Desktop cannot be told WHICH image at call time — under test integration the picker never opens a
   * dialog and hands back whatever `fakeAvatarPickerFile` named when this window was launched. So the
   * animated-ness of this upload was decided by the test's launch context, and a window opened
   * without it would upload a generated solid-colour JPEG here and fail an animation assertion much
   * further on, as "not animated". That is worth a loud error instead.
   */
  public async setAnimatedDisplayPicture(): Promise<void> {
    if (!process.env.SESSION_FAKE_AVATAR_PICKER_FILE) {
      throw new Error(
        'This desktop window was launched with no `fakeAvatarPickerFile`, so its avatar picker can ' +
          'only return a generated solid-colour JPEG — nothing animated is selectable. Pass the ' +
          'animated file in the test context that opens the window.'
      );
    }
    await this.uploadProfilePicture();
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
  // Used when this client observes a PEER's Pro state. `assertConversationHeaderProBadge`,
  // `assertSettingsAvatarAnimated` and `assertConversationHeaderAvatarAnimated` are all on
  // IBaseDeviceWrapper — mobile satisfies the same signatures — so a cross-platform spec can assert
  // them over every client regardless of platform. `verifyElementIsAnimated` itself stays off the
  // interface: it takes a CSS selector here and an Appium locator on mobile, which is exactly the
  // kind of platform-shaped signature the interface forbids. The named wrappers below, each pinned
  // to the surface it reads, are what a cross-platform spec calls instead.

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

  /**
   * Open settings and assert THIS account's own avatar renders animated there.
   *
   * The settings avatar rather than the left-pane button, so both platforms read the SAME surface --
   * mobile has no left pane, and an assertion whose element differs per platform cannot honestly sit
   * on `IBaseDeviceWrapper` under one name.
   *
   * The wait is longer than `verifyElementIsAnimated`'s default because this doubles as the
   * linked-device assertion: when the picture was set on another client, both it and the Pro proof
   * that keeps it unfrozen arrive here by config sync rather than being written locally.
   */
  public async assertSettingsAvatarAnimated(): Promise<void> {
    await clickOn(this.page, LeftPane.settingsButton);
    try {
      await this.verifyElementIsAnimated(
        buildDescendantSelector(Settings.profilePicture, 'img'),
        AVATAR_SYNC_MAX_WAIT_MS
      );
    } finally {
      // Left open, the dialog swallows the next click on anything behind it -- the same reason
      // `waitForOwnProBadge` closes between attempts.
      await this.closeOpenModals().catch(() => undefined);
    }
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

  /**
   * Open `convoName` and verify the peer's conversation-header avatar is NOT animated.
   *
   * The counterpart to `assertConversationHeaderAvatarAnimated`, reading the same surface and asserted
   * the opposite way round: that one retries until it sees more than one colour, so it can stop the
   * moment an animation starts. This has to prove a NEGATIVE, so it settles first and then requires
   * every sample to match — a still frame sampled once, or sampled before the picture has loaded,
   * would pass whatever the client decided.
   *
   * `settleMs` exists for that second failure: the avatar arrives with a message and takes a moment to
   * render, and an unloaded element samples as a single flat colour, which is indistinguishable from a
   * static picture.
   */
  public async verifyConversationHeaderAvatarNotAnimated(
    convoName: string,
    { settleMs = 15_000, samples = 6 }: { settleMs?: number; samples?: number } = {}
  ): Promise<void> {
    await this.openConversationOnceNamed(convoName);
    const selector = buildDescendantSelector(Conversation.conversationSettingsIcon, 'img');
    // The element has to be there before its pixels mean anything.
    await this.page.locator(selector).first().waitFor({ state: 'visible', timeout: 30_000 });
    await sleepFor(settleMs);

    const colors = new Set<string>();
    for (let i = 0; i < samples; i++) {
      colors.add(await this.sampleCenterColor(selector));
      await sleepFor(250);
    }

    // A placeholder is a solid colour, so it satisfies "not animating" — without this a picture that
    // never arrived passes. After the samples, so one still propagating gets the settle window.
    const [sampled] = [...colors];
    if (colors.size === 1 && GENERATED_AVATAR_COLORS.has(sampled.toLowerCase())) {
      throw new Error(
        `${convoName}'s display picture is still the generated placeholder ` +
          `(${sampled}) — it never loaded, so nothing can be said about whether it animates. ` +
          `An upload or propagation problem, not a Pro one.`
      );
    }

    if (colors.size > 1) {
      throw new Error(
        `${convoName}'s display picture is animating for this client (${colors.size} distinct centre ` +
          `colours across ${samples} samples). The proof carrying that feature could not be verified, ` +
          `so it should have been refused.`
      );
    }
  }

  /**
   * Open `convoName` and assert the avatar in its conversation header renders animated.
   *
   * The exact negative of `verifyConversationHeaderAvatarNotAnimated` above, reading the same surface.
   *
   * Same longer wait as the own-avatar case, for the same reason: in a 1:1 this header draws the
   * OTHER person, so both their picture and the proof that unfreezes it arrive over the network —
   * making this a wait rather than a read.
   */
  public async assertConversationHeaderAvatarAnimated(convoName: string): Promise<void> {
    await this.openConversationOnceNamed(convoName);
    await this.verifyElementIsAnimated(
      buildDescendantSelector(Conversation.conversationSettingsIcon, 'img'),
      AVATAR_SYNC_MAX_WAIT_MS
    );
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
  public async assertConversationHeaderProBadge(convoName: string): Promise<void> {
    await this.openConversationOnceNamed(convoName);
    await doWhileWithMax(
      60_000,
      1_000,
      `assertConversationHeaderProBadge ${convoName}`,
      async () => {
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
      }
    );
  }

  /**
   * The receiver-side counterpart of `assertConversationHeaderProBadge`: the sender's badge is gone from here.
   *
   * Both conditions are checked at the SAME instant, and that is the design. The conversation's name
   * being on screen proves this window is rendering the right conversation, so the absence asserted is
   * the badge's and not the screen's — otherwise a window that failed to open satisfies this, and would
   * go on satisfying it if the client stopped honouring revocations entirely.
   *
   * Polled because the badge disappears when the revocation job's sweep reaches this conversation, and
   * that dispatch is debounced (500ms, maxWait 1000ms) on top of the fetch.
   */
  public async assertNoConversationHeaderProBadge(
    convoName: string,
    anchorMessage?: string
  ): Promise<void> {
    await this.openConversationOnceNamed(convoName);

    // A message in this conversation is a stronger anchor than the header: it cannot be satisfied by the
    // wrong conversation, and unlike a header name it does not change when the badge appears.
    const header = anchorMessage
      ? this.page.locator(`[data-testid=message-content]:has-text("${anchorMessage}")`).first()
      : this.page
          .locator(
            `[${Conversation.conversationHeader.strategy}="${Conversation.conversationHeader.selector}"]`
          )
          .first();
    const badge = this.page
      .locator(
        `[${Conversation.proBadgeConversationHeader.strategy}="${Conversation.proBadgeConversationHeader.selector}"]`
      )
      .first();

    let headerSeen = false;
    let cleared = false;
    const deadline = Date.now() + 60_000;
    do {
      if (await header.isVisible().catch(() => false)) {
        headerSeen = true;
        cleared = !(await badge.isVisible().catch(() => false));
      }
      if (!cleared) {
        await sleepFor(1_000);
      }
    } while (!cleared && Date.now() < deadline);

    if (!cleared) {
      throw new Error(
        headerSeen
          ? `${convoName}'s Pro badge is still rendered on the conversation header. The proof was ` +
              `revoked, so this client is still honouring a credential it should have rejected — or it ` +
              `never fetched the revocation list (see SESSION_FORCE_PRO_REVOCATION_REFRESH).`
          : `${convoName}'s conversation header never rendered, so nothing can be said about the ` +
              `badge. This is a navigation problem, not a Pro one.`
      );
    }
  }

  /**
   * The author label above `message` in the currently open conversation, scoped to that one message.
   *
   * Scoping is not tidiness. `pro-badge-contact-name` is `ContactName`'s badge and `ContactName`
   * renders every left-pane row too, so the moment a sender is Pro the same test id also matches their
   * 1:1 row in the conversation list — a page-wide match would go green without the message surface
   * having rendered anything at all. In a community it is scoped for a second reason: every Pro
   * author in the room carries the same badge, so an unscoped match says nothing about who.
   */
  private messageAuthorLabel(message: string) {
    return this.page
      .getByTestId(Conversation.messageContent.selector)
      .filter({ hasText: message })
      .getByTestId(Conversation.messageAuthorName.selector);
  }

  /**
   * Assert the sender's Session Pro badge is rendered on `message`'s author label.
   *
   * A different element from `assertConversationHeaderProBadge`: the author label never renders in a
   * 1:1 (`MessageAuthorText` bails unless `useSelectedIsGroupOrCommunity`), so neither assertion
   * covers the other's surface and a build that lost the badge here would still satisfy the header
   * one. That selector is the inclusive one, so this reads the same element in a group and in a
   * community.
   *
   * Polled rather than read once: this depends on the recipient having received the message, verified
   * the proof it carries and re-rendered off the updated contact record.
   */
  public async assertMessageAuthorProBadge(message: string, maxWaitMs = 60_000): Promise<void> {
    await this.messageAuthorLabel(message)
      .getByTestId(Conversation.proBadgeAuthorName.selector)
      .waitFor({ state: 'visible', timeout: maxWaitMs });
  }

  /**
   * Assert `message`'s author label IS rendered in the open conversation and carries NO Pro badge.
   *
   * Waiting for the label is the half that makes this a control rather than a tautology — an absent
   * badge inside a label that was never rendered says nothing about the badge. Once the label is up the
   * badge is not a later arrival: both come out of one `ContactName` render driven by the sender's
   * stored contact record, so the absence can be read immediately rather than waited out.
   */
  public async assertNoMessageAuthorProBadge(message: string, maxWaitMs = 60_000): Promise<void> {
    const label = this.messageAuthorLabel(message);
    await label.waitFor({ state: 'visible', timeout: maxWaitMs });
    const badges = await label.getByTestId(Conversation.proBadgeAuthorName.selector).count();
    if (badges !== 0) {
      throw new Error(
        `Expected no Pro badge on the author label of "${message}", found ${badges}. The sender is ` +
          `not a subscriber at this point, so a badge here means it is rendered off something other ` +
          `than a verified proof.`
      );
    }
  }

  // --- High-level desktop verbs ---
  // These are desktop-only (not on IBaseDeviceWrapper); they delegate to the ported
  // Page-based helpers, passing this client's page/account implicitly.

  /**
   * Read every movable Pro stat, starting and finishing on the home screen.
   *
   * A fresh visit per reading, matching mobile: the counters are queried when the screen mounts, so a
   * helper that held it open would read the baseline twice and pass whatever the action did.
   */
  /**
   * Pin `convoName` from its row's context menu, and wait for the pinned icon.
   *
   * Waits on the icon rather than returning after the click: the item is a TOGGLE, so a caller that
   * assumed success would silently unpin on a second call.
   */
  public async pinConversation(convoName: string): Promise<void> {
    await this.rightClickOnWithText(HomeScreen.conversationItemName, convoName);
    await clickOn(this.page, HomeScreen.pinMenuItem);
    await waitForElement({
      window: this.page,
      locator: HomeScreen.pinnedConversationIcon,
      options: { maxWaitMs: 10_000 },
    });
  }

  public async readProStats(): Promise<ProStatCounts> {
    return await test.step('Read the Pro stats', async () => {
      await clickOn(this.page, LeftPane.settingsButton);
      await clickOn(this.page, Settings.proMenuItem, { maxWait: 60_000 });
      await waitForElement({
        window: this.page,
        locator: ProSettings.statsHeader,
        options: { maxWaitMs: 60_000 },
      });

      const cells: Record<MovableProStat, StrategyExtractionObj> = {
        'longer-messages': ProSettings.statLongerMessages,
        'pinned-conversations': ProSettings.statPinnedConversations,
        'badges-sent': ProSettings.statBadgesSent,
      };

      const counts = {} as ProStatCounts;
      for (const stat of MOVABLE_PRO_STATS) {
        const el = await waitForElement({
          window: this.page,
          locator: cells[stat],
          options: { maxWaitMs: 10_000 },
        });
        counts[stat] = parseProStatCount(stat, (await el?.textContent()) ?? '');
      }
      this.log(`Pro stats: ${JSON.stringify(counts)}`);

      await this.closeOpenModals().catch(() => undefined);
      return counts;
    });
  }

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

  /** Assert an element is gone. See `waitForElementHidden`; `hidden` also covers never-attached. */
  public async waitForElementHidden(
    args: Omit<Parameters<typeof waitForElementHidden>[0], 'window'>
  ): Promise<void> {
    await waitForElementHidden({ window: this.page, ...args });
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

  public async trustUser(attachmentType: AttachmentType, userName: string): Promise<void> {
    await trustUser(this.page, attachmentType, userName);
  }

  // --- Communities / groups ---

  public async joinCommunity(): Promise<void> {
    await joinCommunity(this.page);
  }

  /**
   * Join the community at `link` and wait for its row in the conversation list.
   *
   * The counterpart of `joinCommunity` for a room the test allocated itself (`communityRooms`),
   * whose link only exists at runtime — `joinCommunity` hardcodes the shared one.
   */
  public async joinCommunityByLink(link: string, name: string): Promise<void> {
    await joinCommunityByLink(this.page, link, name);
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
