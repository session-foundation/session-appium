import { test } from '@playwright/test';

import type { IBaseDeviceWrapper } from '../../../types/IBaseDeviceWrapper';

import { TestSteps } from '../../../types/allure';
import { crossPlatformTest } from '../../utils/cross_platform';
import { friends } from '../../utils/cross_platform_state_builder';

/**
 * Cross-platform two-way message sync. Alice and Bob are seeded as friends via the
 * qa-seeder, each with two linked clients (android + desktop). Each user sends one
 * message to the other; we then assert BOTH messages appear in the 1:1 thread on
 * EVERY client of BOTH users (linked-device convergence + peer delivery).
 */

crossPlatformTest({
  title: 'Friends exchange messages that sync to every linked device',
  risk: 'medium',
  setup: friends({
    alice: { android: 1, desktop: 1 },
    bob: { android: 1, desktop: 1 },
  }),
  testCb: async ({ accounts: { alice, bob } }) => {
    const aliceName = alice.account.userName;
    const bobName = bob.account.userName;

    const aliceMessage = `Hello ${bobName}, this is ${aliceName}`;
    const bobMessage = `Hello ${aliceName}, this is ${bobName}`;

    await test.step(TestSteps.SEND.MESSAGE(aliceName, bobName), async () => {
      // Alice sends to Bob from her android client.
      await alice.android[0].openConversationWith(bobName);
      await alice.android[0].sendMessage(aliceMessage);
    });

    await test.step(TestSteps.SEND.MESSAGE(bobName, aliceName), async () => {
      // Bob sends to Alice from his desktop client.
      await bob.desktop[0].openConversationWith(aliceName);
      await bob.desktop[0].sendMessage(bobMessage);
    });

    // Both messages must land on one client, in its conversation with `convoName`. The two
    // waits share a single session (Appium won't take concurrent commands on one), so they
    // stay sequential here — it's the clients that are verified concurrently, below.
    const verifyBothMessages = async (client: IBaseDeviceWrapper, convoName: string) => {
      await client.openConversationWith(convoName);
      await client.waitForMessage(aliceMessage);
      await client.waitForMessage(bobMessage);
    };

    // Every client is an independent session/window and the assertions are read-only polls,
    // so all four are verified at once rather than paying each client's sync wait in turn.
    await Promise.all([
      test.step(`Verify both messages synced to all of ${aliceName}'s devices`, async () => {
        await Promise.all(alice.clients.map(client => verifyBothMessages(client, bobName)));
      }),
      test.step(`Verify both messages synced to all of ${bobName}'s devices`, async () => {
        await Promise.all(bob.clients.map(client => verifyBothMessages(client, aliceName)));
      }),
    ]);
  },
});
