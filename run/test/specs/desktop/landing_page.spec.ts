// @ported-from tests/automation/landing_page.spec.ts
// @port-kind   spec

import { Conversation } from '../../../desktop/locators';
import { test_Alice_2W } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

test_Alice_2W(`Landing page states`, async ({ alice, alice2 }, _testInfo) => {
  await Promise.all(
    [alice, alice2].map(w =>
      w.waitForElement({
        locator: Conversation.SessionConversation,
        options: { maxWaitMs: 1000, shouldLog: true },
      })
    )
  );

  // Check that the account created has all the required strings displayed
  await Promise.all(
    [
      tStripped('onboardingAccountCreated'),
      tStripped('onboardingBubbleWelcomeToSession', {
        emoji: '👋',
      }),
      tStripped('conversationsNone'),
      tStripped('onboardingHitThePlusButton'),
    ].map(async builder =>
      alice.waitForElement({
        locator: Conversation.EmptyMessageViewCreated,
        options: {
          maxWaitMs: 1_000,
          shouldLog: true,
          text: builder.toString(),
        },
      })
    )
  );

  // Check that the account restored has all the required strings displayed
  await Promise.all(
    [tStripped('conversationsNone'), tStripped('onboardingHitThePlusButton')].map(async builder =>
      alice2.waitForElement({
        locator: Conversation.EmptyMessageViewWelcome,
        options: {
          maxWaitMs: 1_000,
          shouldLog: true,
          text: builder.toString(),
        },
      })
    )
  );

  // Make sure the "account created" part is not visible on the restored window
  await Promise.all(
    [
      tStripped('onboardingAccountCreated'),
      tStripped('onboardingBubbleWelcomeToSession', {
        emoji: '👋',
      }),
    ].map(async builder =>
      alice2.hasElementPoppedUpThatShouldnt(
        Conversation.EmptyMessageViewCreated,
        builder.toString()
      )
    )
  );
});
