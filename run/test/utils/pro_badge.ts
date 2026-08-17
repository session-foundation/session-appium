import { test } from '@playwright/test';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CloseSettings } from '../locators';
import { MessageBody } from '../locators/conversation';
import { ConversationItem } from '../locators/home';
import {
  ConversationHeaderProBadge,
  ProBadgeSettingToggle,
  ProSettingsEntry,
} from '../locators/pro';
import { UserSettings } from '../locators/settings';
import { SupportedPlatformsType } from './open_app';

/**
 * How each platform reports a switch's on/off state.
 *
 * iOS exposes it as `value` (`'1'`/`'0'`); UiAutomator2 has no `value` attribute at all and rejects the
 * request outright, naming `checked` (`'true'`/`'false'`) as the equivalent. Reading the wrong one is
 * not a soft failure — the driver throws before any assertion runs.
 */
const TOGGLE_STATE_ATTRIBUTE = { android: 'checked', ios: 'value' } as const;
const TOGGLE_ON = { android: 'true', ios: '1' } as const;

async function readToggleState(
  device: DeviceWrapper,
  platform: SupportedPlatformsType
): Promise<string | null> {
  const toggle = await device.waitForTextElementToBePresent(new ProBadgeSettingToggle(device));
  return device.getAttribute(TOGGLE_STATE_ATTRIBUTE[platform], toggle.ELEMENT);
}

/**
 * Turns the current user's Pro badge on, from anywhere the user settings button is reachable, and
 * leaves the app back where it started.
 *
 * **Being Pro is not the same as advertising it.** Badge visibility is a separate per-user setting and
 * is off by default; a grant writes the proof and the expiry and touches the badge bit in neither. Any
 * spec asserting that someone *else* can see a badge has to call this first, which is why it lives here
 * rather than inline.
 *
 * Read-then-set rather than a bare tap: a blind toggle flips whatever state it finds, so it would
 * silently disable the badge the day the default changes — and a tap that lands on the row instead of
 * the switch does nothing at all, which is indistinguishable from success until an assertion fails
 * several steps later. Hence the read-back, which turns that into an immediate, named failure.
 */
export async function enableProBadge(
  device: DeviceWrapper,
  platform: SupportedPlatformsType
): Promise<void> {
  await test.step('Turn the Pro badge on', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));

    if ((await readToggleState(device, platform)) !== TOGGLE_ON[platform]) {
      const toggle = await device.waitForTextElementToBePresent(new ProBadgeSettingToggle(device));
      await device.click(toggle.ELEMENT);
    }

    const state = await readToggleState(device, platform);
    if (state !== TOGGLE_ON[platform]) {
      throw new Error(
        `Pro badge toggle is still off (${TOGGLE_STATE_ATTRIBUTE[platform]}=${state}) after being set. ` +
          `Without it the user advertises no badge, and any later badge assertion would fail as though ` +
          `the feature were broken. On iOS the toggle is also guarded on a proof existing, so this is ` +
          `the visible symptom of a missing entitlement rather than a toggle bug.`
      );
    }

    await device.navigateBack();
    await device.clickOnElementAll(new CloseSettings(device));
  });
}

/**
 * Asserts that `sender`'s Pro badge renders for the device's user, opening their 1:1 first.
 *
 * The message is waited on before the badge because the badge travels with it — asserting the badge
 * first would be a race rather than a check. `message` must be one the sender has already sent.
 *
 * In a 1:1 the badge renders in the conversation **header** only, never beside the message: the author
 * label that carries it is group-only (`shouldShowAuthorName` guards on `isGroupThread`).
 */
export async function expectProBadgeFromSender(
  device: DeviceWrapper,
  senderName: string,
  message: string
): Promise<void> {
  await test.step(`See ${senderName}'s Pro badge`, async () => {
    await device.clickOnElementAll(new ConversationItem(device, senderName));
    await device.waitForTextElementToBePresent(new MessageBody(device, message));
    await device.waitForTextElementToBePresent(new ConversationHeaderProBadge(device));
  });
}
