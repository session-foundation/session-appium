import { blake2b } from '@noble/hashes/blake2.js';

import { blind15Sign, identityFromSeed, SogsIdentity } from './sogs_auth';

/**
 * The first message in a freshly created community room.
 *
 * A room with no messages in it is not a state the clients handle: `joinCommunity` waits for a
 * message body to appear before it considers the room open, and an empty room never produces one, so
 * the join *hangs* rather than failing. Creating a room therefore includes posting to it — see
 * `allocateCommunityRooms`.
 *
 * Which means the message has to be one a client will render, i.e. a real Session message: a
 * protobuf `Content` carrying a `DataMessage`. The three field numbers used below come from
 * SessionProtos.proto (`Content.dataMessage = 1`; `DataMessage.body = 1`, `.timestamp = 7`,
 * `.profile = 101`; `LokiProfile.displayName = 1`) and are encoded by hand: pulling in a protobuf
 * runtime and a copy of the schema to keep in sync would be a lot of machinery for one fixed
 * message whose shape never varies.
 */

const SEED_DISPLAY_NAME = 'Room Seeder';

// --- protobuf wire format ------------------------------------------------------------------------

const VARINT = 0;
const LENGTH_DELIMITED = 2;

function varint(value: bigint | number): Uint8Array {
  let remaining = BigInt(value);
  const bytes: Array<number> = [];
  do {
    const septet = Number(remaining & 0x7fn);
    remaining >>= 7n;
    bytes.push(remaining > 0n ? septet | 0x80 : septet);
  } while (remaining > 0n);
  return new Uint8Array(bytes);
}

function tag(field: number, wireType: number): Uint8Array {
  return varint((field << 3) | wireType);
}

function concat(parts: Array<Uint8Array>): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** A `bytes`/`string`/embedded-message field: tag, then length, then the payload. */
function delimitedField(field: number, payload: Uint8Array): Uint8Array {
  return concat([tag(field, LENGTH_DELIMITED), varint(payload.length), payload]);
}

function stringField(field: number, value: string): Uint8Array {
  return delimitedField(field, new Uint8Array(Buffer.from(value, 'utf-8')));
}

function varintField(field: number, value: bigint | number): Uint8Array {
  return concat([tag(field, VARINT), varint(value)]);
}

// --- the message ---------------------------------------------------------------------------------

/**
 * Sender for a room's seed message: derived from the room token, so it is stable for a given room and
 * distinct between rooms, and belongs to no real account.
 *
 * Deliberately not the admin identity that creates the room. SOGS takes a user's display name from
 * the messages they post, so seeding as the admin would rename the admin account to the seeder's
 * name in every room — visible to the community moderation tests, which restore that same account.
 */
export function seedIdentityForRoom(token: string): SogsIdentity {
  return identityFromSeed(
    blake2b(new Uint8Array(Buffer.from(token, 'utf-8')), {
      dkLen: 32,
      personalization: new Uint8Array(Buffer.from('sogsseed'.padEnd(16, '\0'), 'utf-8')),
    })
  );
}

/**
 * The body of a `POST /room/<token>/message` request that seeds `roomName`.
 *
 * `data` is padded before signing and sent padded: Session appends `0x80` followed by zero bytes to
 * hide a message's true length, the signature covers the padded bytes, and SOGS records the padded
 * length so it can hand a client back exactly what was signed. The minimum such padding is the
 * `0x80` and one zero byte.
 *
 * The signature is by the *blinded* key, not the account key, because that is the key a reader checks
 * it against: SOGS records the poster as the blinded id the request authenticated with, and a client
 * verifies a message against the key in its sender's id. Signing with the account key would produce
 * a message every client discards — which, since the room then still looks empty, would hang the join
 * exactly as an unseeded room does.
 */
export function buildSeedMessage(token: string, roomName: string, serverPubkey: Uint8Array) {
  const content = delimitedField(
    1, // Content.dataMessage
    concat([
      stringField(1, `Welcome to ${roomName}!`), // DataMessage.body
      varintField(7, Date.now()), // DataMessage.timestamp (ms)
      delimitedField(101, stringField(1, SEED_DISPLAY_NAME)), // DataMessage.profile.displayName
    ])
  );

  const padded = concat([content, new Uint8Array([0x80, 0x00])]);
  const identity = seedIdentityForRoom(token);
  const { signature } = blind15Sign(identity, serverPubkey, padded);

  return {
    identity,
    request: {
      data: Buffer.from(padded).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
    },
  };
}
