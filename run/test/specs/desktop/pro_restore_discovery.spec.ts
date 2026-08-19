import { Conversation, HomeScreen } from '../../../desktop/locators';
import { sessionTestTwoWindows } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';
import { PRO_MAX_CHARS } from '../../../shared/constants';

/** How far short of the limit to stop, so the countdown is on screen to be read. */
const COUNTDOWN_AT = 5;

/**
 * Whether a restored subscriber is Pro **before they go looking**.
 *
 * `Pro survives a restore from seed` asserts the same entitlement but reaches it through the Pro
 * settings screen, which refreshes status on arrival — so it passes whether or not the config-driven
 * refresh works, and cannot see that path breaking. This spec deliberately never opens settings on the
 * restored window.
 *
 * The composer's character countdown is the observable because it is computed from the client's own
 * Pro state with no navigation and no second party: a client that believes it is not Pro caps at 2000,
 * so a countdown reading against the Pro cap can only come from a status the client actually holds.
 */
sessionTestTwoWindows(
  'Pro is discovered on a restored device without opening settings',
  async ([alice, restored]) => {
    const account = await alice.onboard('Alice');

    await alice.subscribeToPro();
    // On the first window only: this is what writes the access expiry into config, which is the state
    // the restore then has to carry. Doing the same on the restored window would test the wrong thing.
    await alice.waitForProActive();

    // The account is seconds old, so its profile may not have reached the network yet and the restore
    // prompts for a name. This spec asserts entitlement, not the display name.
    await restored.restoreFromSeed(account.seedPhrase, 'Alice');

    // Note to Self rather than a contact: the restored account is Alice's own, so there is no second
    // party to message, and the cap applies the same way.
    await restored.clickOn(HomeScreen.plusButton);
    await restored.clickOn(HomeScreen.newMessageOption);
    await restored.pasteIntoInput(HomeScreen.newMessageAccountIDInput.selector, account.sessionId);
    await restored.clickOn(HomeScreen.newMessageNextButton);
    await restored.waitForTestIdWithText('header-conversation-name', tStripped('noteToSelf'));

    await restored.pasteIntoInput(
      'message-input-text-area',
      'x'.repeat(PRO_MAX_CHARS - COUNTDOWN_AT)
    );
    await restored.waitForElement({
      locator: Conversation.tooltipCharacterCount,
      options: { text: String(COUNTDOWN_AT) },
    });
  },
  { pro: {} }
);
