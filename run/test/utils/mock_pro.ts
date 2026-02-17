/**
 * Session Pro Test Account Setup
 *
 * Registers test accounts as Pro subscribers against the Session Pro dev backend,
 * bypassing Google Play / Apple App Store verification entirely.
 *
 * Based on:
 * https://github.com/session-foundation/session-pro-backend/blob/main/examples/endpoint_example.py
 *
 * Usage:
 *   import { makeAccountPro } from './mock_pro';
 *
 *   await makeAccountPro({
 *     mnemonic: 'word1 word2 ... word13',
 *     provider: 'google' // or 'apple'
 *   });
 *
 * In order for the changes to take effect in the clients it's best to force close and restart the app
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { PRO_BACKEND_URL } from '../../constants';

type PaymentProvider = 'apple' | 'google';

type MakeAccountProParams = {
  mnemonic: string;
  provider: PaymentProvider;
  dryRun?: boolean; // If true, build and print the request but don't send it
};

type AddProPaymentRequest = {
  version: number;
  master_pkey: string;
  rotating_pkey: string;
  master_sig: string;
  rotating_sig: string;
  payment_tx: {
    provider: number;
    google_payment_token?: string;
    google_order_id?: string;
    apple_tx_id?: string;
  };
};

type ProProof = {
  version: number;
  expiry_unix_ts_ms: number;
  gen_index_hash: string;
  rotating_pkey: string;
  sig: string;
};

type AddProPaymentResponse = {
  status: number;
  result?: ProProof;
  errors?: string[];
};

let WORDLIST_CACHE: string[] | null = null;

function getWordlist(): string[] {
  if (WORDLIST_CACHE) {
    return WORDLIST_CACHE;
  }

  const wordlistPath = join(__dirname, '../../../english_wordlist.txt');
  const content = readFileSync(wordlistPath, 'utf-8');
  const words = content
    .split('\n')
    .map(w => w.trim())
    .filter(Boolean);

  if (words.length !== 1626) {
    throw new Error(`Expected 1626 words in wordlist, got ${words.length}`);
  }

  WORDLIST_CACHE = words;
  return words;
}

// Decodes a 13-word recovery phrase a 16-byte seed hex string. */
function mnemonicToSeedHex(mnemonic: string): string {
  const wordlist = getWordlist();
  const n = wordlist.length; // 1626

  const words = mnemonic.toLowerCase().trim().split(/\s+/);
  if (words.length !== 13) {
    throw new Error(`Expected 13 words, got ${words.length}`);
  }

  // Build word -> index lookup
  const wordToIdx = new Map<string, number>();
  wordlist.forEach((w, i) => wordToIdx.set(w, i));

  // Resolve word indices (with prefix matching support)
  const indices: number[] = [];
  for (const word of words) {
    if (wordToIdx.has(word)) {
      indices.push(wordToIdx.get(word)!);
    } else {
      // Try prefix match (first 4 chars)
      const matches = wordlist
        .map((w, i) => ({ w, i }))
        .filter(({ w }) => w.startsWith(word.slice(0, 4)));

      if (matches.length === 1) {
        indices.push(matches[0].i);
      } else {
        throw new Error(`Unknown or ambiguous mnemonic word: '${word}'`);
      }
    }
  }

  // Decode: every 3 words -> 4 bytes (little-endian)
  const dataIndices = indices.slice(0, 12);
  const seedBytes: number[] = [];
  for (let i = 0; i < 12; i += 3) {
    const w1 = dataIndices[i];
    const w2 = dataIndices[i + 1];
    const w3 = dataIndices[i + 2];

    const x = w1 + n * ((((w2 - w1) % n) + n) % n) + n * n * ((((w3 - w2) % n) + n) % n);

    // Convert to 4 bytes little-endian
    seedBytes.push(x & 0xff);
    seedBytes.push((x >> 8) & 0xff);
    seedBytes.push((x >> 16) & 0xff);
    seedBytes.push((x >> 24) & 0xff);
  }

  if (seedBytes.length !== 16) {
    throw new Error(`Expected 16 bytes, got ${seedBytes.length}`);
  }

  return Buffer.from(seedBytes).toString('hex');
}

function padSeed(seedHex: string): Uint8Array {
  const seed = Buffer.from(seedHex, 'hex');
  if (seed.length !== 16) {
    throw new Error(`Seed must be 16 bytes, got ${seed.length}`);
  }

  // Pad with 16 zero bytes
  const padded = new Uint8Array(32);
  padded.set(seed, 0);
  return padded;
}

// Derives the Pro master keypair from the seed using Blake2b with "SessionProRandom" as the key.
function deriveProMasterKey(seedHex: string): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const padded = padSeed(seedHex);

  // Blake2b-256 with "SessionProRandom" as the key
  const proSeed = blake2b(padded, {
    dkLen: 32,
    key: Buffer.from('SessionProRandom', 'utf-8'),
  });

  const privateKey = proSeed;
  const publicKey = ed25519.getPublicKey(privateKey);

  return { privateKey, publicKey };
}

// Generates a random ephemeral rotating keypair for the payment request.
function generateRotatingKey(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

function makeAddProPaymentHash(
  version: number,
  masterPubkey: Uint8Array,
  rotatingPubkey: Uint8Array,
  provider: number,
  paymentToken?: string,
  orderId?: string,
  appleTxId?: string
): Uint8Array {
  const personalization = Buffer.from('ProAddPayment___', 'utf-8'); // 16 bytes

  const parts: Uint8Array[] = [
    new Uint8Array([version]),
    masterPubkey,
    rotatingPubkey,
    new Uint8Array([provider]),
  ];

  if (provider === 1) {
    // Google
    if (!paymentToken || !orderId) {
      throw new Error('Google provider requires payment_token and order_id');
    }
    parts.push(Buffer.from(paymentToken, 'utf-8'));
    parts.push(Buffer.from(orderId, 'utf-8'));
  } else if (provider === 2) {
    // Apple
    if (!appleTxId) {
      throw new Error('Apple provider requires tx_id');
    }
    parts.push(Buffer.from(appleTxId, 'utf-8'));
  }

  // Concatenate all parts
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const message = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    message.set(part, offset);
    offset += part.length;
  }

  return blake2b(message, { dkLen: 32, personalization });
}

// Builds a signed add_pro_payment request body with fake payment tokens.
function buildAddProPaymentRequest(
  masterKey: { privateKey: Uint8Array; publicKey: Uint8Array },
  rotatingKey: { privateKey: Uint8Array; publicKey: Uint8Array },
  provider: PaymentProvider
): AddProPaymentRequest {
  const version = 0;
  const providerNum = provider === 'google' ? 1 : 2;

  let paymentToken: string | undefined;
  let orderId: string | undefined;
  let appleTxId: string | undefined;

  const timestamp = Date.now();
  const nonce = randomBytes(4).toString('hex');

  if (provider === 'google') {
    paymentToken = `DEV.${timestamp}.${nonce}`;
    orderId = `DEV.${timestamp}.${nonce}`;
  } else {
    appleTxId = `DEV.${timestamp}.${nonce}`;
  }

  const hash = makeAddProPaymentHash(
    version,
    masterKey.publicKey,
    rotatingKey.publicKey,
    providerNum,
    paymentToken,
    orderId,
    appleTxId
  );

  const masterSig = ed25519.sign(hash, masterKey.privateKey);
  const rotatingSig = ed25519.sign(hash, rotatingKey.privateKey);

  const paymentTx: AddProPaymentRequest['payment_tx'] = {
    provider: providerNum,
  };

  if (provider === 'google') {
    paymentTx.google_payment_token = paymentToken;
    paymentTx.google_order_id = orderId;
  } else {
    paymentTx.apple_tx_id = appleTxId;
  }

  return {
    version,
    master_pkey: Buffer.from(masterKey.publicKey).toString('hex'),
    rotating_pkey: Buffer.from(rotatingKey.publicKey).toString('hex'),
    master_sig: Buffer.from(masterSig).toString('hex'),
    rotating_sig: Buffer.from(rotatingSig).toString('hex'),
    payment_tx: paymentTx,
  };
}

// POSTs the payment request to the Pro backend with retries and timeout.
async function addProPayment(
  backendUrl: string,
  request: AddProPaymentRequest,
  { maxAttempts = 3, timeout = 10_000 } = {}
): Promise<AddProPaymentResponse> {
  const url = `${backendUrl}/add_pro_payment`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as AddProPaymentResponse;

      if (!response.ok || data.status !== 0) {
        throw new Error(
          `Failed to add Pro payment: ${data.errors?.join(', ') || `HTTP ${response.status}`}`
        );
      }

      return data;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (attempt === maxAttempts) {
        throw new Error(`add_pro_payment failed after ${maxAttempts} attempts: ${msg}`);
      }
      console.log(`add_pro_payment attempt ${attempt}/${maxAttempts} failed: ${msg}, retrying...`);
    }
  }

  throw new Error('Unreachable');
}

// Registers a test account as a Pro subscriber against the dev backend.
export async function makeAccountPro(params: MakeAccountProParams): Promise<ProProof | null> {
  const { mnemonic, provider, dryRun = false } = params;
  const seedHex = mnemonicToSeedHex(mnemonic);
  const masterKey = deriveProMasterKey(seedHex);
  const rotatingKey = generateRotatingKey();
  // Build request
  const request = buildAddProPaymentRequest(masterKey, rotatingKey, provider);
  console.log('\nRequest body:');
  console.log(JSON.stringify(request, null, 2));

  if (dryRun) {
    console.log('\nDRY RUN - Request not sent');
    return null;
  }

  // Send request
  console.log(`\nSending request to ${PRO_BACKEND_URL}...`);
  const response = await addProPayment(PRO_BACKEND_URL, request);

  if (!response.result) {
    throw new Error('No proof in response');
  }

  console.log('Account successfully registered as Pro');
  console.log(`  Expiry: ${new Date(response.result.expiry_unix_ts_ms).toISOString()}`);

  return response.result;
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      'Usage: npx ts-node run/test/utils/mock_pro.ts <mnemonic> <provider> [--dry-run]'
    );
    console.error('Example: npx ts-node run/test/utils/mock_pro.ts "word1 word2 ..." google');
    console.error(
      '         npx ts-node run/test/utils/mock_pro.ts "word1 word2 ..." apple --dry-run'
    );
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => a !== '--dry-run');
  const [mnemonic, provider] = filteredArgs;

  makeAccountPro({
    mnemonic,
    provider: provider as PaymentProvider,
    dryRun,
  })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
