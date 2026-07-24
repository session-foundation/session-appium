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
  allureSuites: { parent: 'Sending Messages', suite: 'Message types' },
  allureDescription:
    'Alice (android + desktop) and Bob (android + desktop) are friends; each sends a message and both messages appear on every device of both users.',
  testCb: async ({ accounts: { alice, bob } }) => {
    const aliceName = alice.account.userName;
    const bobName = bob.account.userName;

    const aliceMessage = `Hello ${bobName}, this is ${aliceName}`;
    const bobMessage = `Hello ${aliceName}, this is ${bobName}`;

    // Alice sends to Bob from her android client.
    await alice.android[0].openConversationWith(bobName);
    await alice.android[0].sendMessage(aliceMessage);

    // Bob sends to Alice from his desktop client.
    await bob.desktop[0].openConversationWith(aliceName);
    await bob.desktop[0].sendMessage(bobMessage);

    // Every Alice client shows both messages in the conversation with Bob.
    for (const client of alice.clients) {
      await client.openConversationWith(bobName);
      await client.waitForMessage(aliceMessage);
      await client.waitForMessage(bobMessage);
    }

    // Every Bob client shows both messages in the conversation with Alice.
    for (const client of bob.clients) {
      await client.openConversationWith(aliceName);
      await client.waitForMessage(aliceMessage);
      await client.waitForMessage(bobMessage);
    }
  },
});
