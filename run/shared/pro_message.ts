import { type NetworkArg, sendProMessage, type StateUser } from '@session-foundation/qa-seeder';

import { OVER_PRO_LIMIT_CHARS, overProLimitMessage } from './message';
import { devProBackendUrl } from './pro_grant';

/**
 * Store a message on `to`'s swarm that is one character past the Pro limit, signed with a real proof.
 *
 * Wrapped rather than called raw so both suites send the same body against the same backend. The
 * seeder is the only thing that can produce this message at all — every client refuses to compose past
 * the limit — so the sender is an account with no app, and `from` never needs a device.
 *
 * Two failure modes this is placed to catch early, because both look like a client bug from the
 * recipient's side:
 *
 *   - a body the seeder shortened, which would leave the recipient with nothing over the limit to cut;
 *   - a proof that is already dead, which a `durationSeconds` on the send would produce. A recipient
 *     polling after it expires reads the sender as non-Pro and truncates at the STANDARD limit, which
 *     is a different spec's outcome — so the logged remaining life is worth reading when this fails.
 */
export async function sendOverProLimitMessage({
  from,
  to,
  network,
  tag,
}: {
  from: StateUser;
  to: StateUser;
  network: NetworkArg;
  tag: string;
}): Promise<string> {
  const body = overProLimitMessage(tag);

  const result = await sendProMessage({
    from: { seed: from.seed, sessionId: from.sessionId },
    to: to.sessionId,
    body,
    network,
    proBackendUrl: devProBackendUrl(),
  });

  if (result.bodyLength !== OVER_PRO_LIMIT_CHARS) {
    throw new Error(
      `sendOverProLimitMessage: asked to send ${OVER_PRO_LIMIT_CHARS} characters but the seeder sent ` +
        `${result.bodyLength}. Nothing downstream is over the Pro limit, so the recipient has nothing ` +
        `to truncate and the assertion would pass against a client that never applied the limit.`
    );
  }

  const secondsLeft = result.proofExpiryAtSeconds - Math.floor(Date.now() / 1000);
  if (secondsLeft <= 0) {
    throw new Error(
      `sendOverProLimitMessage: the proof from ${from.userName} expired ${-secondsLeft}s ago. The ` +
        `recipient would read the sender as non-Pro and cut the body at the standard limit.`
    );
  }
  console.log(
    `Seeded a ${result.bodyLength}-character Pro message from ${from.userName} to ${to.userName}, ` +
      `proof good for another ${secondsLeft}s (store statuses ${result.storeStatuses.join(', ')})`
  );

  return body;
}
