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
 *   import { makeAccountPro } from '../../shared/pro_grant';
 *
 *   await makeAccountPro({ user: alice, platform });
 *
 * In order for the changes to take effect in the clients it's best to force close and restart the app
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { mnDecode } from '@session-foundation/mnemonic';
import { isString } from 'lodash';

export type PaymentProvider = 'apple' | 'google' | 'stf';

/**
 * The account to grant Pro to, kept structural rather than requiring the seeder's full `StateUser`:
 * both guards below are optional, so a spec that assembled an account itself can still mint.
 *
 * This used to bridge two spellings (mobile `recoveryPhrase` / desktop `recoveryPassword`). Both
 * platforms now use the seeder's `StateUser`, so a `StateUser` satisfies this as-is.
 */
export type ProAccountUnderTest = {
  userName: string;
  /** `05…` Account ID. Optional because some specs opt out of reading it; the mint is guarded when present. */
  sessionId?: string;
  /** The account's seed words. */
  seedPhrase?: string;
};

/** The seed words, or a clear failure rather than a mint against an empty phrase. */
export function seedWordsOf(user: ProAccountUnderTest): string {
  const words = user.seedPhrase;
  if (!words) {
    throw new Error(`seedWordsOf: ${user.userName} has no seedPhrase`);
  }
  return words;
}

/**
 * An entitlement short enough to sit inside every client's expiry-warning window, which is seven days
 * on all three — far enough from the boundary that a slow run cannot cross it.
 *
 * Stated rather than inherited from a plan: the QA backend's compressed clock shortens *proof* expiry,
 * not the account entitlement, so a nominal `1M` plan really does land 30 days out.
 */
export const EXPIRING_SOON_ENTITLEMENT_SECONDS = 2 * 24 * 60 * 60;

type MakeAccountProParams = {
  user: ProAccountUnderTest;
  // Provider is derived from the platform (ios -> apple, android -> google) unless an explicit
  // `provider` is given, which is how Desktop registers a payment with no platform to derive from.
  platform?: 'android' | 'ios';
  provider?: PaymentProvider;
  /** Billing period to grant (default `1M`). */
  plan?: '12M' | '1M' | '3M';
  /**
   * Override the plan's nominal length, in seconds, for a spec that needs the entitlement to end at a
   * particular distance from now. See `EXPIRING_SOON_ENTITLEMENT_SECONDS`.
   */
  durationSeconds?: number;
  dryRun?: boolean; // If true, build and print the request but don't send it
};

/**
 * Provider codes as the backend names them. The protocol transmits enums as stable string codes,
 * never integers (pro-wire-protocol.md §1; backend `base.PaymentProvider`).
 *
 * The two store providers make an account look like a real purchase, which is what most specs want.
 *
 * `stf` is the Session Technology Foundation's out-of-band grant and is NOT a store — no purchase, no
 * store account, nothing to manage or refund through a platform. It is the only provider we can grant
 * that has no store behind it, which makes it the fixture for every "this plan did not come from a
 * store" branch, and the one that shows what a client does with a provider it cannot route to a store.
 */
const PROVIDER_CODE: Record<PaymentProvider, string> = {
  google: 'google_play',
  apple: 'app_store',
  stf: 'stf',
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

/** The envelope every `/dev/*` route answers with, success or refusal. */
type DevResponse<TResult> = {
  status: string;
  result?: TResult;
  error?: string;
  error_code?: string;
};

type DevRevokeRequest = {
  master_pkey: string;
  /**
   * Seconds from now until peers should begin rejecting proofs carrying the revoked tag. 0 is
   * already-effective, which is what a spec asserting enforcement needs; a positive value lands inside
   * the grace window, for one asserting a revoked-but-not-yet-effective proof is still honoured.
   *
   * Production cannot produce either: it stamps `revoked_at` from its own clock and the served list
   * adds a fixed 26 hours, so this is the whole reason the route exists.
   */
  effective_in_seconds?: number;
  /**
   * True (the default) models a REFUND — the payments go too, so the entitlement is gone and the
   * account stops being Pro. False revokes only the generation, leaving a still-paid account entitled
   * and rolling it onto a new one: its old proof dies while it remains Pro.
   */
  revoke_payments?: boolean;
};

type DevRevokeResult = {
  revoked_generation_id: number;
  /** When peers should begin rejecting the revoked tag, in unix seconds. */
  effective_ts: number;
  /** False is the refund outcome: no usable payment remained, so nothing was rolled onto. */
  new_generation_allocated: boolean;
  payments_revoked: boolean;
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
  if (!isString(seedHex)) {
    throw new Error(`Expected a string seed, got ${typeof seedHex}`);
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

/** A refusal the backend answered with, as opposed to a failure to reach it. Not retried. */
class DevRouteRefusal extends Error {}

/**
 * POST to one of the backend's `/dev/*` routes, with the retry and the failure message they share.
 *
 * Generic in the request and result because the two routes we use differ only in their payloads: a
 * 200 carrying `status: "fail"` is how both report a refusal, so neither can be read from the status
 * line alone.
 */
async function devPost<TRequest, TResult>(
  backendUrl: string,
  route: string,
  request: TRequest,
  { maxAttempts = 3, timeout = 10_000 } = {}
): Promise<TResult> {
  const url = `${backendUrl}${route}`;

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
      const data = (await response.json()) as DevResponse<TResult>;

      if (!response.ok || data.status !== 'ok' || !data.result) {
        // The backend answers 200 with status "fail" and its reason in `error`/`error_code`, so the
        // HTTP code alone says nothing. Fall back to the raw body rather than the status line.
        const reason =
          data.error || `HTTP ${response.status}, body: ${JSON.stringify(data).slice(0, 300)}`;
        // An answered refusal is the backend's verdict on the request, not a hiccup — retrying it
        // cannot change the outcome, and doing so buries the reason under two spurious attempts.
        throw new DevRouteRefusal(reason);
      }

      return data.result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (error instanceof DevRouteRefusal) {
        throw new Error(`POST ${route} was refused: ${msg}`);
      }
      if (attempt === maxAttempts) {
        throw new Error(
          `POST ${route} failed after ${maxAttempts} attempts: ${msg}\n` +
            `Is a QA Pro backend running at ${backendUrl}? The Sesh-Net-Docker \`pro-backend\` ` +
            `container publishes one on :8090; production has no /dev routes.`
        );
      }
      console.log(`POST ${route} attempt ${attempt}/${maxAttempts} failed: ${msg}, retrying...`);
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

/**
 * The account's Pro master public key, hex, with the two guards that make a wrong key visible.
 *
 * Derived from the recovery phrase, so a grant — or a revocation — binds to the account the test just
 * created without the app having to tell us anything. Shared by the mint and the revoke precisely so
 * that a revocation cannot address a different key than the grant did; the backend's lookups are bare
 * `WHERE master_pkey = ?`, so a mismatch reads as "never subscribed" rather than as an error.
 */
function masterPkeyHexOf(user: ProAccountUnderTest, caller: string): string {
  const seedHex = mnemonicToSeedHex(seedWordsOf(user));

  // Fail here rather than three screens later. `sessionId` is absent when a spec opted out of reading
  // it, in which case there is nothing to check against.
  if (user.sessionId && user.sessionId.startsWith('05')) {
    const derived = accountIdFromSeed(seedHex);
    if (derived !== user.sessionId) {
      throw new Error(
        `${caller}: the recovery phrase does not belong to ${user.userName}. Derived ${derived} but ` +
          `the account under test is ${user.sessionId}. The request would silently address a ` +
          `different account, and the client would then report "never" as if nothing had happened.`
      );
    }
  }

  assertNotSharedAdminAccount(seedHex, user.userName);

  return Buffer.from(deriveProMasterKey(seedHex).publicKey).toString('hex');
}

export async function makeAccountPro(
  params: MakeAccountProParams
): Promise<DevAddPaymentResult | null> {
  const {
    user,
    platform,
    provider: providerParam,
    plan = '1M',
    durationSeconds,
    dryRun = false,
  } = params;
  const provider: PaymentProvider = providerParam ?? (platform === 'ios' ? 'apple' : 'google');

  const request: DevAddPaymentRequest = {
    master_pkey: masterPkeyHexOf(user, 'makeAccountPro'),
    provider: PROVIDER_CODE[provider],
    plan,
    ...(durationSeconds === undefined ? {} : { duration: durationSeconds }),
  };

  const backendUrl = devProBackendUrl();

  if (dryRun) {
    console.log(`DRY RUN — would POST to ${backendUrl}/dev/add_payment:`);
    console.log(JSON.stringify(request, null, 2));
    return null;
  }

  const result = await devPost<DevAddPaymentRequest, DevAddPaymentResult>(
    backendUrl,
    '/dev/add_payment',
    request
  );

  // A backend that ignored `duration` returns the plan's full length instead — 30 days where a spec
  // asked for two — and the only symptom is whatever that spec expected of a near expiry quietly not
  // happening. The tolerance is an hour because the gap being caught is orders of magnitude larger.
  if (durationSeconds !== undefined && result.account_expiry_ts) {
    const grantedSeconds = result.account_expiry_ts - Math.floor(Date.now() / 1000);
    if (grantedSeconds > durationSeconds + 3600) {
      throw new Error(
        `makeAccountPro: asked for a ${durationSeconds}s entitlement but the backend granted ` +
          `${grantedSeconds}s (until ${new Date(result.account_expiry_ts * 1000).toISOString()}). ` +
          `The \`duration\` override was not applied, so any expiry-window assertion downstream would ` +
          `be testing the plan's nominal length instead.`
      );
    }
  }

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

export type RevokeAccountProParams = {
  user: ProAccountUnderTest;
  /** See `DevRevokeRequest.effective_in_seconds`. Defaults to 0 — already effective. */
  effectiveInSeconds?: number;
  /** See `DevRevokeRequest.revoke_payments`. Defaults to true — a refund. */
  revokePayments?: boolean;
};

/**
 * Revoke the account's current Pro generation, so peers holding the revocation list stop honouring any
 * proof it issued.
 *
 * There is no client-side route to this and no production one either: a real revocation's effective
 * instant is `revoked_at + 26 hours`, deliberately, so that a sender cannot be rejected before it could
 * have polled and learnt of it. `/dev/revoke` backdates the stored instant to place that effective
 * moment where a spec asks for it, which is the only way a test can observe enforcement rather than
 * wait a day for it.
 *
 * Two independent behaviours, chosen by `revokePayments`:
 *   - **true (refund)** — the entitlement goes too, so the account stops being Pro and no fresh
 *     generation is issued. What a chargeback looks like.
 *   - **false (rotation)** — the account stays paid and rolls onto a new generation, so its old proof
 *     is dead while it remains Pro. What a recipient must reject without the sender losing anything.
 *
 * The call does not make the revocation *visible* to anyone: each client caches the list on its own
 * schedule, so a spec still has to get the recipient to poll before asserting.
 */
export async function revokeAccountPro(params: RevokeAccountProParams): Promise<DevRevokeResult> {
  const { user, effectiveInSeconds = 0, revokePayments = true } = params;

  const request: DevRevokeRequest = {
    master_pkey: masterPkeyHexOf(user, 'revokeAccountPro'),
    effective_in_seconds: effectiveInSeconds,
    revoke_payments: revokePayments,
  };

  const backendUrl = devProBackendUrl();
  const result = await devPost<DevRevokeRequest, DevRevokeResult>(
    backendUrl,
    '/dev/revoke',
    request
  );

  // `new_generation_allocated` is the one field that distinguishes the two behaviours after the fact,
  // and a spec asking for a rotation that silently got a refund would be asserting the wrong thing —
  // the account would have stopped being Pro rather than kept a dead proof.
  console.log(
    `Revoked generation ${result.revoked_generation_id} for ${user.userName} ` +
      `(master_pkey ${request.master_pkey}), effective ` +
      `${new Date(result.effective_ts * 1000).toISOString()}, ` +
      `payments_revoked=${result.payments_revoked}, ` +
      `rolled onto a new generation=${result.new_generation_allocated}`
  );

  if (!revokePayments && !result.new_generation_allocated) {
    throw new Error(
      `revokeAccountPro: asked to revoke only the generation for ${user.userName}, but the backend ` +
        `allocated no replacement — so the account is no longer entitled. It had no live payment to ` +
        `roll onto, which means this behaves as a refund and there is no surviving Pro state for a ` +
        `dead-proof assertion to sit on.`
    );
  }

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

  // Revoking by hand is worth a mode of its own: it is the only way to watch a client react to a
  // revocation live, on a device a spec is not driving.
  if (args.includes('--revoke')) {
    const rest = args.filter(a => a !== '--revoke' && a !== '--keep-payments');
    const effectiveIndex = rest.indexOf('--effective-in');
    const effectiveInSeconds =
      effectiveIndex === -1 ? 0 : Number.parseInt(rest[effectiveIndex + 1] ?? '', 10);

    if (Number.isNaN(effectiveInSeconds)) {
      console.error('--effective-in takes a number of seconds');
      process.exit(1);
    }

    const mnemonicArg = rest.find(
      (_arg, i) => i !== effectiveIndex && (effectiveIndex === -1 || i !== effectiveIndex + 1)
    );
    if (!mnemonicArg) {
      console.error(
        'Usage: npx ts-node run/shared/pro_grant.ts <mnemonic> --revoke [--keep-payments] ' +
          '[--effective-in <seconds>]'
      );
      process.exit(1);
    }

    revokeAccountPro({
      user: { userName: 'CLI', seedPhrase: mnemonicArg },
      revokePayments: !args.includes('--keep-payments'),
      effectiveInSeconds,
    })
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
      });
  } else if (args.length < 2) {
    console.error('Usage: npx ts-node run/shared/pro_grant.ts <mnemonic> <platform> [--dry-run]');
    console.error('Example: npx ts-node run/shared/pro_grant.ts "word1 word2 ..." android');
    console.error('         npx ts-node run/shared/pro_grant.ts "word1 word2 ..." ios --dry-run');
    console.error('         npx ts-node run/shared/pro_grant.ts "word1 word2 ..." --revoke');
    process.exit(1);
  } else {
    const dryRun = args.includes('--dry-run');
    const filteredArgs = args.filter(a => a !== '--dry-run');
    const [mnemonic, platform] = filteredArgs;

    makeAccountPro({
      user: { userName: '', sessionId: '', seedPhrase: mnemonic },
      platform: platform as 'android' | 'ios',
      dryRun,
    })
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
      });
  }
}
