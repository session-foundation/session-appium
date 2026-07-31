import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { randomBytes } from 'crypto';

import { mnemonicToSeedHex, padSeed } from './mock_pro';

/**
 * Authenticated requests to a SOGS (community server) HTTP API.
 *
 * SOGS authenticates a request by a signature over its own details, in four `X-SOGS-*` headers, and
 * a server may require that the signer identify itself by a *blinded* id rather than its real one —
 * `require_blind_keys`, which is on by default and which the devnet SOGS deliberately leaves on so
 * it behaves like production. Blinding maps an account to a per-server id, so the same account looks
 * like an unrelated user on each server it talks to; the server can't reverse it, so it can moderate
 * a user within a room without learning who they are elsewhere.
 *
 * That means signing here is not plain Ed25519 over the account key: the key itself is transformed
 * first, and the signature has to be produced by hand rather than by `ed25519.sign`. The
 * implementation below is a transliteration of libsession-util's `blind15_key_pair` /
 * `blind15_sign` (src/blinding.cpp), which is what the Session clients themselves use — so a request
 * from here is indistinguishable from a request from a client.
 */

/** Order of the Ed25519 group; all scalar arithmetic below is mod this. */
const L = ed25519.Point.Fn.ORDER;

/** An account that can sign SOGS requests: an Ed25519 seed and the public key it derives. */
export type SogsIdentity = {
  edPubkey: Uint8Array;
  seed: Uint8Array;
};

export type SogsResponse = {
  /** Parsed JSON, or `{}` for an empty body. */
  body: unknown;
  status: number;
};

export type SogsRequest = {
  base: string;
  body?: unknown;
  identity: SogsIdentity;
  method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  /** Request path, including a query string if there is one. */
  path: string;
  serverPubkey: Uint8Array;
  timeoutMs?: number;
};

// --- byte and scalar helpers ---------------------------------------------------------------------
//
// Ed25519 scalars are 32-byte little-endian integers. libsodium exposes arithmetic on them directly
// (crypto_core_ed25519_scalar_*); noble does not, so they are converted to BigInt and back. The
// reductions mod L are what libsodium's scalar_reduce/_mul/_add do implicitly.

function scalarFromBytes(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

function scalarToBytes(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number((value >> BigInt(8 * i)) & 0xffn);
  }
  return out;
}

function concat(...parts: Array<Uint8Array>): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const utf8 = (value: string) => new Uint8Array(Buffer.from(value, 'utf-8'));
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/**
 * The x25519 private scalar for an Ed25519 seed — libsodium's
 * `crypto_sign_ed25519_sk_to_curve25519`: the first half of sha512(seed), clamped.
 */
function x25519Scalar(seed: Uint8Array): Uint8Array {
  const scalar = sha512(seed).slice(0, 32);
  scalar[0] &= 248;
  scalar[31] &= 127;
  scalar[31] |= 64;
  return scalar;
}

/**
 * The blinded keypair this identity presents to the server with this public key: `k` derives from
 * the server's key alone, so every account blinds consistently for a given server and differently
 * across servers.
 */
function blind15KeyPair(identity: SogsIdentity, serverPubkey: Uint8Array) {
  const k = scalarFromBytes(blake2b(serverPubkey, { dkLen: 64 })) % L;
  const a = scalarFromBytes(x25519Scalar(identity.seed));
  const blindedScalar = (k * a) % L;
  return {
    blindedPubkey: ed25519.Point.BASE.multiply(blindedScalar).toBytes(),
    blindedScalar,
  };
}

/**
 * Sign `message` such that the server verifies it against the blinded public key.
 *
 * Hand-rolled rather than `ed25519.sign` because the signing key is a bare scalar (the product of
 * the account scalar and the blinding factor) with no seed behind it, which is not a shape the
 * standard API accepts. The result is an ordinary Ed25519 signature over the blinded key, so the
 * server verifies it with no knowledge that blinding was involved.
 *
 * `r` — the per-signature nonce — is derived from the account key and the message, matching what the
 * clients do. Its derivation is not part of the protocol: any `r` verifies, as long as the same one
 * is used for both halves. It must never be reused across messages, which deriving it from the
 * message guarantees.
 */
export function blind15Sign(
  identity: SogsIdentity,
  serverPubkey: Uint8Array,
  message: Uint8Array
): { blindedPubkey: Uint8Array; signature: Uint8Array } {
  const { blindedPubkey, blindedScalar } = blind15KeyPair(identity, serverPubkey);

  const nonceSeed = sha512(concat(identity.seed, identity.edPubkey)).slice(32);
  const r = scalarFromBytes(sha512(concat(nonceSeed, blindedPubkey, message))) % L;
  const sigR = ed25519.Point.BASE.multiply(r).toBytes();

  const hram = scalarFromBytes(sha512(concat(sigR, blindedPubkey, message))) % L;
  const sigS = (r + ((hram * blindedScalar) % L)) % L;

  return { blindedPubkey, signature: concat(sigR, scalarToBytes(sigS)) };
}

/** The account behind a 13-word Session recovery phrase (e.g. SOGS_ADMIN_SEED). */
export function identityFromRecoveryPhrase(recoveryPhrase: string): SogsIdentity {
  return identityFromSeed(padSeed(mnemonicToSeedHex(recoveryPhrase)));
}

/** The account behind a raw 32-byte Ed25519 seed. */
export function identityFromSeed(seed: Uint8Array): SogsIdentity {
  return { edPubkey: ed25519.getPublicKey(seed), seed };
}

/** The blinded Session id this identity presents to the server with this public key. */
export function blindedSessionId(identity: SogsIdentity, serverPubkey: Uint8Array): string {
  return `15${hex(blind15KeyPair(identity, serverPubkey).blindedPubkey)}`;
}

/**
 * Make a signed request, returning the status alongside the body rather than throwing on failure:
 * callers distinguish outcomes that are not errors (a delete of a room that has already gone) from
 * ones that are, and a bare status is too little to report either usefully.
 */
export async function sogsRequest(request: SogsRequest): Promise<SogsResponse> {
  const { base, body, identity, method, path, serverPubkey, timeoutMs = 30_000 } = request;

  const nonce = new Uint8Array(randomBytes(16));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = body === undefined ? undefined : utf8(JSON.stringify(body));

  // Signed over: SERVER_PUBKEY || NONCE || TIMESTAMP || METHOD || PATH [|| '?' || QUERY] || HBODY,
  // where HBODY is blake2b(body, 64) and is omitted entirely when there is no body. The query string
  // is included with its `?` only when the request actually has one — a trailing `?` with nothing
  // after it is not accepted (see handle_http_auth in sogs/routes/auth.py).
  let signed = concat(serverPubkey, nonce, utf8(timestamp + method + path));
  if (payload?.length) {
    signed = concat(signed, blake2b(payload, { dkLen: 64 }));
  }

  const { blindedPubkey, signature } = blind15Sign(identity, serverPubkey, signed);

  const response = await fetch(`${base}${path}`, {
    body: payload,
    headers: {
      'X-SOGS-Nonce': base64(nonce),
      'X-SOGS-Pubkey': `15${hex(blindedPubkey)}`,
      'X-SOGS-Signature': base64(signature),
      'X-SOGS-Timestamp': timestamp,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    method,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let parsed: unknown = {};
  if (text !== '') {
    try {
      parsed = JSON.parse(text);
    } catch {
      // SOGS answers its own errors as plain text, and anything else on the port (a proxy, the wrong
      // service) will not be JSON either. Keep the body so the caller can report it.
      parsed = text;
    }
  }

  return { body: parsed, status: response.status };
}

/** Describe a failed response for an error message, preferring SOGS's own explanation. */
export function describeFailure(response: SogsResponse): string {
  if (typeof response.body === 'string' && response.body !== '') {
    return `HTTP ${response.status}: ${response.body.trim().split('\n')[0]}`;
  }
  return `HTTP ${response.status}`;
}
