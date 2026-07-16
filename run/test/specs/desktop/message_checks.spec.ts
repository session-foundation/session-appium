// Smoke subset ported from session-playwright (tests/automation/message_checks.spec.ts).
// Rewritten to drive the app through DesktopWrapper. The full media/community/pro/link-preview
// cases are deferred to the bulk-port phase; this validates the account + contact + messaging
// pipeline end-to-end through the wrapper harness.

import { test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';

test_Alice_1W_Bob_1W('Send message 1:1 (smoke)', async ({ alice, bob }) => {
  await alice.createContactWith(bob);

  const testMessage = `${alice.userName} sending a smoke message to ${bob.userName}`;
  await alice.sendMessage(testMessage);

  // Bob's conversation with Alice is already open from createContact; the message should arrive.
  await bob.waitForTextMessage(testMessage, 20_000);
});
