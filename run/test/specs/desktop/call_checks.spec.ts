// @ported-from tests/automation/call_checks.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { Global, HomeScreen } from '../../../desktop/locators';
import { test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

test_Alice_1W_Bob_1W('Voice calls', async ({ alice, bob }) => {
  await alice.createContactWith(bob);
  await bob.clickOn(HomeScreen.plusButton);
  await bob.clickOnWithText(Global.contactItem, 'Note to Self');
  await alice.makeVoiceCallTo(bob);
  // In the receivers window, the message is 'Call in progress'
  await bob.waitForTestIdWithText(
    'call-notification-answered-a-call',
    tStripped('callsInProgress')
  );
  // Control message should be '{callerName} called you'
  // await waitForTestIdWithText(
  //   bobWindow1,
  //   'call-notification-answered-a-call',
  //   tStripped('callsCalledYou')
  //     .withArgs({ name: caller.userName })
  //     .toString(),
  // );
  // In the callers window, the message is 'You called {reciverName}'
  await alice.waitForTestIdWithText(
    'call-notification-started-call',
    tStripped('callsYouCalled', { name: bob.userName })
  );
});
