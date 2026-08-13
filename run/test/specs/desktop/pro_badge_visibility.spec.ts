import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';

const MESSAGE = 'Checking my badge shows for you';

/**
 * One of the few Pro assertions that genuinely needs the backend rather than a display mock: the
 * mocks are per-device, so they make Alice's own client believe she is Pro but produce no proof for
 * Bob's client to verify. Bob rendering the badge is the real test of the end-to-end grant.
 *
 * Both windows are already pointed at the QA backend by the run's `TEST_PRO_BACKEND_*` env — a Bob on
 * the production key would read Alice's QA-signed proof as invalid, silently strip the Pro content
 * and store her as non-Pro, which looks like a product bug rather than a misconfigured test.
 */
test_Alice_1W_Bob_1W(
  'Pro badge shows to other users',
  async ({ alice, bob }) => {
    await alice.createContactWith(bob);

    await alice.subscribeToPro();
    // Desktop asks the backend for status only at startup, so the grant is invisible until restart.
    await restartApp(alice, { pro: {} });
    await alice.waitForProActive();
    await alice.enableProBadge();

    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(MESSAGE);

    await bob.waitForMessage(MESSAGE);
    await bob.assertSenderProBadge(alice.userName);
  },
  { pro: {} }
);
