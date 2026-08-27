import { Conversation } from '../../../desktop/locators';
import { test_Alice_1W_10contacts } from '../../../desktop/sessionTest';

/** Marks the end of the message, so finding it proves the tail is reachable rather than the head. */
const TAIL_MARKER = 'END-OF-LONG-MESSAGE';

/**
 * Long enough to wrap past the 25-line threshold, at the standard character limit so no Pro is involved.
 *
 * Sized by characters rather than newlines because **newlines do not survive the composer**: a body with
 * `\n` between each line arrives as one run-on line ("line 1line 2line 3..."), which then wraps to far
 * fewer rendered lines than it has logical ones. Measured on screen rather than assumed.
 *
 * The threshold is rendered LINES (`MAX_MESSAGE_MAX_LINES_BEFORE_READ_MORE`), so this depends on bubble
 * width, which depends on the window. Measured at the harness's window size: ~43 characters per line,
 * so 2,000 characters is ~46 lines — comfortably over 25, with room for a wider bubble. A window roughly
 * twice as wide would put it back on the boundary, so if this ever fails at the collapse assertion,
 * check the window size before the app.
 */
const LONG_MESSAGE = `${'word '.repeat(Math.floor((2000 - TAIL_MARKER.length) / 5))}${TAIL_MARKER}`;

/**
 * The collapsed message bubble, and the button that opens it.
 *
 * A message past 25 rendered lines (`MAX_MESSAGE_MAX_LINES_BEFORE_READ_MORE`) is clamped with a Read
 * More button. Neither the bubble nor the button was addressable until session-desktop#1999, so this
 * row has been uncovered here.
 *
 * **Two ids, and the second is what makes the assertion mean anything.** The button renders only while
 * the message is collapsed, so its absence after a click is the natural expansion assertion — but an
 * assertion that something is *gone* passes just as well when it was never there, against a button that
 * failed to render or an id that stopped matching. Checking the bubble is still present alongside is
 * what separates "it expanded" from "it vanished".
 *
 * No Pro anywhere: the collapse is a rendering rule about line count, and the message sits inside the
 * standard character limit.
 */
test_Alice_1W_10contacts(
  'A long message collapses and Read More expands it',
  async ({ alice, contactNames }) => {
    await alice.openConversationWith(contactNames[0]);
    await alice.pasteIntoInput('message-input-text-area', LONG_MESSAGE);
    // Sent through the button rather than `sendMessage`, which confirms delivery by building a CSS
    // selector from the message body — a multi-line body makes that selector unparseable
    // (`Unsupported token "BADSTRING"`). The bubble appearing below is the delivery signal instead.
    await alice.clickOn(Conversation.sendMessageButton);

    const bubble = alice.getPage().locator('[data-testid=message-bubble]').last();
    const readMore = alice.getPage().locator('[data-testid=read-more-button]').last();

    // Presence of the button IS the collapse assertion: it renders only when the text overflows.
    await readMore.waitFor({ state: 'visible', timeout: 30_000 });

    await readMore.click();

    // Both halves. The button going away says the bubble expanded; the bubble still being there says it
    // expanded rather than disappeared, which the first assertion alone cannot distinguish.
    await readMore.waitFor({ state: 'detached', timeout: 30_000 });
    await bubble.waitFor({ state: 'visible', timeout: 30_000 });
  }
);
