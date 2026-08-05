import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ConversationType, DISAPPEARING_TIMES, MergedOptions } from '../../types/testing';
import { ConversationSettings } from '../locators/conversation';
import {
  DisappearingMessageRadial,
  DisappearingMessagesMenuOption,
  DisappearingMessagesSubtitle,
  DisappearingMessagesTimerType,
  SetDisappearMessagesButton,
} from '../locators/disappearing_messages';

/**
 * The disappearing-message duration the tests should use.
 *
 * These specs have to wait out the timer for real, so the duration is a floor on their runtime —
 * they're the slowest group in the suite. 30 seconds exists because 10 was too tight against
 * mainnet's onion-routing latency; on a local devnet propagation is near-instant, so 10 is enough
 * and saves ~20s per spec.
 *
 * Devnet is detected two ways because neither alone is sufficient: `DETECTED_NETWORK_TARGET` is the
 * resolved value (a seed URL when on devnet, on both platforms) but is only set once
 * `resolveNetworkTarget` has run, which is after module load — and some specs pick their duration at
 * module level. `NETWORK_TARGET` is the user-supplied setting, available immediately. Anything we
 * can't positively identify as devnet keeps its off-devnet duration.
 *
 * `offDevnet` is what to use when we're not on a devnet. It defaults to 30 seconds, but specs that
 * deliberately chose something longer for reliability (community interactions, large attachments)
 * must pass their own value so this can't silently shorten them on mainnet.
 */
export function getDisappearingTestTime(
  offDevnet: DISAPPEARING_TIMES = DISAPPEARING_TIMES.THIRTY_SECONDS
): DISAPPEARING_TIMES {
  const detected = process.env.DETECTED_NETWORK_TARGET ?? '';
  const requested = (process.env.NETWORK_TARGET ?? '').trim().toLowerCase();
  const onDevnet = detected.startsWith('http') || requested === 'devnet';
  return onDevnet ? DISAPPEARING_TIMES.TEN_SECONDS : offDevnet;
}

/**
 * Timings for waiting out the disappearing timer, both derived from the duration the test set.
 *
 * - `expectedDuration` is the timer itself, and is what the "disappeared suspiciously early" check
 *   measures against (see hasElementDisappeared).
 * - `maxWait` is the timeout, and is the timer plus a *fixed* allowance for send, propagation and
 *   the poll's own debounce. Fixed rather than proportional because that overhead doesn't shrink
 *   with the timer: at 10 seconds it was observed to add up to ~3.3s, which a proportional buffer
 *   would not have covered.
 *
 * `bufferMs` is that allowance. It defaults to the 5s the text specs used; the attachment specs
 * pass 10s, matching the extra headroom they already gave themselves for media download. Together
 * with `offDevnet` this reproduces each spec's previous off-devnet value exactly (35_000, 65_000,
 * 70_000), so nothing changes away from a devnet.
 */
export function getDisappearingTestTiming(
  offDevnet?: DISAPPEARING_TIMES,
  bufferMs: number = 5_000
): {
  expectedDuration: number;
  maxWait: number;
} {
  const time = getDisappearingTestTime(offDevnet);
  // Values look like "10 seconds" / "1 minute", so the unit matters — parsing the number alone
  // would read "1 minute" as 1ms*1000.
  const [amount, unit] = time.split(' ');
  const count = Number.parseInt(amount, 10);
  const unitMs = unit?.startsWith('second') ? 1_000 : unit?.startsWith('minute') ? 60_000 : 0;
  if (!Number.isFinite(count) || unitMs === 0) {
    throw new Error(
      `Cannot derive timings from disappearing time "${time}" — expected seconds or minutes`
    );
  }
  const expectedDuration = count * unitMs;
  return { expectedDuration, maxWait: expectedDuration + bufferMs };
}

export const setDisappearingMessage = async (
  device: DeviceWrapper,
  [conversationType, timerType, timerDuration = getDisappearingTestTime()]: MergedOptions
) => {
  const enforcedType: ConversationType = conversationType;
  await device.clickAndWaitFor(
    new ConversationSettings(device),
    new DisappearingMessagesMenuOption(device)
  );
  await device.clickOnElementAll(new DisappearingMessagesMenuOption(device));
  if (enforcedType === '1:1') {
    await device.clickOnElementAll(new DisappearingMessagesTimerType(device, timerType));
  }
  await device.clickOnElementAll(new DisappearingMessageRadial(device, timerDuration));
  await device.clickOnElementAll(new SetDisappearMessagesButton(device));
  await device.navigateBack();
  await device.waitForTextElementToBePresent(new DisappearingMessagesSubtitle(device));
};
