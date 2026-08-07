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
 *   await makeAccountPro({ user: alice, platform });
 *
 * In order for the changes to take effect in the clients it's best to force close and restart the app
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { mnDecode } from '@session-foundation/mnemonic';

import type { SupportedPlatformsType } from './open_app';

import { User } from '../../types/testing';

export type PaymentProvider = 'apple' | 'google';

type MakeAccountProParams = {
  user: User;
  // Provider is derived from the platform (ios -> apple, android -> google) unless
  // an explicit `provider` is given. `provider` lets non-mobile callers (e.g. desktop)
  // register a Pro payment without coupling to a mobile `SupportedPlatformsType`.
  platform?: SupportedPlatformsType;
  provider?: PaymentProvider;
  /** Billing period to grant (default `1M`). */
  plan?: '12M' | '1M' | '3M';
  dryRun?: boolean; // If true, build and print the request but don't send it
};

/**
 * Provider codes as the backend names them. The protocol transmits enums as stable string codes,
 * never integers (pro-wire-protocol.md §1; backend `base.PaymentProvider`).
 *
 * We mint against the store providers rather than the out-of-band one so the resulting account looks
 * like a real purchase. That also keeps us clear of the `rangeproof` → `stf` rename currently
 * landing on the clients: these two names are not changing.
 */
const PROVIDER_CODE: Record<PaymentProvider, string> = {
  google: 'google_play',
  apple: 'app_store',
};

type DevAddPaymentRequest = {
  master_pkey: string;
  provider: string;
  /** Billing period. The route also accepts the wire codes (`1m`/`3m`/`1y`). */
  plan: '12M' | '1M' | '3M';
  /** Optional override of the plan's nominal length, in seconds — for short-expiry tests. */
  duration?: number;
};

type DevAddPaymentResult = {
  provider: string;
  payment_id: string;
  plan: string;
  /** Account entitlement end, in unix seconds. 0 when the payment was left unclaimed. */
  account_expiry_ts: number;
  redeemed: boolean;
};

type DevAddPaymentResponse = {
  status: string;
  result?: DevAddPaymentResult;
  error?: string;
  error_code?: string;
};

/**
 * Decodes a 13-word recovery phrase to a 16-byte seed hex string.
 *
 * `mnDecode` is the same decoder the clients use, so the wordset, the prefix matching and the
 * checksum word are all its problem rather than ours. `pnpm test-pro-keys` pins the result to
 * libsession's committed vectors.
 */
export function mnemonicToSeedHex(mnemonic: string): string {
  const seedHex = mnDecode(mnemonic.toLowerCase().trim());
  // Asserted rather than assumed: everything downstream (padSeed, the Pro master key, the Account ID)
  // is sized off this, and a short seed would surface as an unrelated crypto failure.
  if (seedHex.length !== 32) {
    throw new Error(`Expected a 16-byte seed, got ${seedHex.length / 2} bytes`);
  }

  return seedHex;
}

export function padSeed(seedHex: string): Uint8Array {
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
/**
 * The Account ID (`05` + x25519 pubkey) for a seed, used to prove a mint targets the account actually
 * under test.
 *
 * This exists because a wrong seed is otherwise invisible: `/dev/add_payment` creates a `users` row for
 * **whatever** key it is given, so minting for the wrong account still answers `redeemed=true` with a
 * real expiry, and the only symptom is the client later reporting `never` — which is indistinguishable
 * from "never subscribed". Seeded accounts are regenerated per run, so this is a genuinely easy mistake
 * to make when comparing values by hand across runs.
 */
function accountIdFromSeed(seedHex: string): string {
  const edPub = ed25519.getPublicKey(padSeed(seedHex));

  // ed25519 -> curve25519 public key: u = (1 + y) / (1 - y) mod p, little-endian.
  const p = (1n << 255n) - 19n;
  const mod = (a: bigint) => ((a % p) + p) % p;
  const invert = (a: bigint) => {
    let [oldR, r, oldS, sCur] = [mod(a), p, 1n, 0n];
    while (r !== 0n) {
      const q = oldR / r;
      [oldR, r] = [r, oldR - q * r];
      [oldS, sCur] = [sCur, oldS - q * sCur];
    }
    return mod(oldS);
  };
  const y = ed25519.Point.fromBytes(edPub).toAffine().y;
  let u = mod((1n + y) * invert(mod(1n - y)));

  const le = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    le[i] = Number(u & 0xffn);
    u >>= 8n;
  }
  return `05${le.toString('hex')}`;
}

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

/**
 * Mint a Pro subscription through the backend's dev route, which exists only on an instance started
 * with `dev_endpoints` (and which refuses to boot unless `provider_dry_run` is set too). No store,
 * no provider notification, and no signature — the route is unauthenticated by design because it
 * cannot exist in production.
 *
 * This is the only way a test account can become Pro. The authenticated endpoints all *redeem* a
 * payment the backend already witnessed from Apple or Google; none of them mints one, so a payment
 * a client invented can never be redeemed.
 */
/**
 * The QA Pro backend to mint against — never the production one.
 *
 * `TEST_PRO_BACKEND_URL` is set by `resolveDevnetServices` once it has probed a Pro backend (or pinned
 * by hand). Deliberately not falling back to `PRO_BACKEND_URL`: that is production, where `/dev/*`
 * does not exist by design, so a fallback would turn a missing local backend into a confusing 404
 * against a live service.
 */
function devProBackendUrl(): string {
  const url = (process.env.TEST_PRO_BACKEND_URL ?? '').trim();
  if (!url) {
    throw new Error(
      'No QA Pro backend to mint against: TEST_PRO_BACKEND_URL is unset. Start the Sesh-Net-Docker ' +
        '`pro-backend` container and set TEST_PRO_BACKEND_ED_PK (from `docker logs sesh-net-pro-backend`) ' +
        'so discovery can resolve it, or pin TEST_PRO_BACKEND_URL directly.'
    );
  }
  return url;
}

async function devAddPayment(
  backendUrl: string,
  request: DevAddPaymentRequest,
  { maxAttempts = 3, timeout = 10_000 } = {}
): Promise<DevAddPaymentResult> {
  const url = `${backendUrl}/dev/add_payment`;

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
      const data = (await response.json()) as DevAddPaymentResponse;

      if (!response.ok || data.status !== 'ok' || !data.result) {
        // The backend answers 200 with status "fail" and its reason in `error`/`error_code`, so the
        // HTTP code alone says nothing. Fall back to the raw body rather than the status line.
        const reason =
          data.error || `HTTP ${response.status}, body: ${JSON.stringify(data).slice(0, 300)}`;
        throw new Error(reason);
      }

      return data.result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (attempt === maxAttempts) {
        throw new Error(
          `dev/add_payment failed after ${maxAttempts} attempts: ${msg}\n` +
            `Is a QA Pro backend running at ${backendUrl}? The Sesh-Net-Docker \`pro-backend\` ` +
            `container publishes one on :8090; production has no /dev routes.`
        );
      }
      console.log(`dev/add_payment attempt ${attempt}/${maxAttempts} failed: ${msg}, retrying...`);
    }
  }

  throw new Error('Unreachable');
}

/**
 * The shared moderation account, as a fallback for when `SOGS_ADMIN_SEED` isn't in this process's
 * environment. Only the public identifier — the phrase is a secret and lives in `.env` / CI secrets.
 *
 * Kept in step with `SOGS_ADMIN_SESSION_IDS` in `Sesh-Net-Docker/sogs/docker-compose.yml`.
 */
const SOGS_ADMIN_ACCOUNT_ID = '050efb87b8fde0b362ea33f9e87c7ee00ef61c23004d4450e80c7343f384ed4107';

/**
 * Refuse to grant Pro to the shared moderation account.
 *
 * Every other account a test touches is generated per run and discarded, so a grant is disposable —
 * it lives on a Pro backend that is shared by every job and never reset, but nothing ever looks at
 * that row again. `SOGS_ADMIN_SEED` is the one exception: a fixed identity reused by every run, on
 * every platform. Granting it Pro would be **permanent**, and would renew on each re-run.
 *
 * The symptom would surface far from the cause — some later spec asserting non-Pro behaviour for the
 * admin failing on CI only, with no recent change to explain it — which is why this fails loudly at
 * the mint instead.
 *
 * The account-under-test check cannot catch this: a spec that deliberately passes the admin phrase
 * derives a matching account id and sails through.
 */
function assertNotSharedAdminAccount(seedHex: string, userName: string): void {
  const adminPhrase = (process.env.SOGS_ADMIN_SEED ?? '').trim();
  const adminAccountId = adminPhrase
    ? accountIdFromSeed(mnemonicToSeedHex(adminPhrase))
    : SOGS_ADMIN_ACCOUNT_ID;

  if (accountIdFromSeed(seedHex) !== adminAccountId) {
    return;
  }

  throw new Error(
    `makeAccountPro: refusing to grant Pro to the shared moderation account (as ${userName}). That ` +
      `account is reused by every run and every CI job, and the Pro backend is shared and never ` +
      `reset — so the grant would be permanent and would renew on every re-run, breaking any later ` +
      `test that expects it to be non-Pro. Use a per-test account instead.`
  );
}

export async function makeAccountPro(
  params: MakeAccountProParams
): Promise<DevAddPaymentResult | null> {
  const { user, platform, provider: providerParam, plan = '1M', dryRun = false } = params;
  const provider: PaymentProvider = providerParam ?? (platform === 'ios' ? 'apple' : 'google');
  // The master Pro key is derived from the account's recovery phrase, so the grant binds to the
  // account the test just created without the app having to tell us anything.
  const seedHex = mnemonicToSeedHex(user.recoveryPhrase);

  // Fail at the mint rather than three screens later. `accountID` is 'not_needed' when a spec opted out
  // of reading it, in which case there is nothing to check against.
  if (user.accountID && user.accountID.startsWith('05')) {
    const derived = accountIdFromSeed(seedHex);
    if (derived !== user.accountID) {
      throw new Error(
        `makeAccountPro: the recovery phrase does not belong to ${user.userName}. Derived ${derived} ` +
          `but the account under test is ${user.accountID}. Minting would silently grant Pro to a ` +
          `different account, and the client would then report "never" as if nothing was purchased.`
      );
    }
  }

  assertNotSharedAdminAccount(seedHex, user.userName);

  const masterKey = deriveProMasterKey(seedHex);

  const request: DevAddPaymentRequest = {
    master_pkey: Buffer.from(masterKey.publicKey).toString('hex'),
    provider: PROVIDER_CODE[provider],
    plan,
  };

  const backendUrl = devProBackendUrl();

  if (dryRun) {
    console.log(`DRY RUN — would POST to ${backendUrl}/dev/add_payment:`);
    console.log(JSON.stringify(request, null, 2));
    return null;
  }

  const result = await devAddPayment(backendUrl, request);

  // `redeemed: false` means the payment was minted but left unbound. Redemption is implicit, so the
  // account holder's next authenticated request reconciles it — but the app won't be Pro yet at the
  // moment this returns, which is the sort of thing that reads as a flaky test rather than a timing
  // one, so say it plainly.
  // The master_pkey is logged because a mismatch between it and the key the CLIENT signs with is
  // indistinguishable, from the client's side, from "never subscribed": the backend's status lookup is
  // a bare `WHERE master_pkey = ?`, so a wrong key yields `never` rather than an error.
  console.log(
    `Minted a ${result.plan} ${result.provider} payment (redeemed=${result.redeemed}) ` +
      `for master_pkey ${request.master_pkey}, ` +
      `entitlement until ${
        result.account_expiry_ts
          ? new Date(result.account_expiry_ts * 1000).toISOString()
          : 'unclaimed'
      }`
  );

  return result;
}

/**
 * Committed libsession test vectors (`tests/test_ed25519.cpp`), plus one derived by `pro-task-review`
 * for a zero-padded 16-byte seed — the shape Session accounts actually use.
 *
 * These pin the Pro master-key derivation to libsession with no device and no backend. Worth keeping:
 * a divergence here is otherwise only observable as a client reporting `never`, which reads as a
 * product bug or a flaky test rather than a harness one.
 */
const PRO_KEY_VECTORS: ReadonlyArray<{ ed25519Seed: string; masterPkey: string }> = [
  {
    ed25519Seed: 'e5481635020d6f7b327e94e6d63e33a431fccabc4d2775845c43a8486a9f2884',
    masterPkey: 'b6d20c075eddd2edb69d4d7da9b7e580f187ce0537585da2b5e454b77980d0c8',
  },
  {
    ed25519Seed: '743d646706b6b04b97b752036dd6cf5f2adc4b339fcfdfb4b496f0764bb93a84',
    masterPkey: '539d0a3be9658ebb6ba3ce97b25d4f6b716f7ef6d6ae6343bd0733519f5a51e8',
  },
  {
    ed25519Seed: 'c5fc4263e28ab3ad0e3de67789b23dd100000000000000000000000000000000',
    masterPkey: '7bcccfab74ea2e0929208a4a610e3b30b2046b38a9c78efe6ec221905b8ef595',
  },
];

/** Throws if the Pro master-key derivation has drifted from libsession. */
export function assertProKeyDerivationMatchesLibSession(): void {
  const failures = PRO_KEY_VECTORS.flatMap(({ ed25519Seed, masterPkey }) => {
    // The vectors are full 32-byte ed25519 seeds, so bypass the 16 -> 32 padding step.
    const proSeed = blake2b(Buffer.from(ed25519Seed, 'hex'), {
      dkLen: 32,
      key: Buffer.from('SessionProRandom', 'utf-8'),
    });
    const actual = Buffer.from(ed25519.getPublicKey(proSeed)).toString('hex');
    return actual === masterPkey
      ? []
      : [`  seed ${ed25519Seed}\n    expected ${masterPkey}\n    actual   ${actual}`];
  });

  if (failures.length > 0) {
    throw new Error(
      `Pro master-key derivation no longer matches libsession:\n${failures.join('\n')}`
    );
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) {
    assertProKeyDerivationMatchesLibSession();
    console.log(`Pro key derivation matches libsession (${PRO_KEY_VECTORS.length} vectors)`);
    process.exit(0);
  }

  if (args.length < 2) {
    console.error(
      'Usage: npx ts-node run/test/utils/mock_pro.ts <mnemonic> <platform> [--dry-run]'
    );
    console.error('Example: npx ts-node run/test/utils/mock_pro.ts "word1 word2 ..." android');
    console.error(
      '         npx ts-node run/test/utils/mock_pro.ts "word1 word2 ..." ios --dry-run'
    );
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => a !== '--dry-run');
  const [mnemonic, platform] = filteredArgs;

  makeAccountPro({
    user: { userName: '' as any, accountID: '', recoveryPhrase: mnemonic },
    platform: platform as SupportedPlatformsType,
    dryRun,
  })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
