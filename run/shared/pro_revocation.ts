// Fixture values shared by the revocation and unverifiable-proof specs, which come in mobile/desktop
// pairs asserting the same behaviour. Declared once because a pair that disagrees still passes twice:
// each half proves its own client consistent with itself, so drift here is invisible until the two
// results are compared by hand.

/**
 * Restart options that make a desktop client poll for revocations at test speed. Forcing the poll is what
 * lets these specs run at all.
 *
 * The backend serves the production cadence — `retry_in: 86400`, and inside libSession's [60s, 48h] clamp,
 * so nothing shortens it — which puts a client's second poll a day after its first. Without the flag the
 * recipient never learns of the revocation inside the run, and every absence asserted afterwards would be
 * satisfied by a client that had simply not looked.
 */
export const DESKTOP_PRO_CONTEXT = { pro: { forceProRevocationRefresh: true } } as const;

/** Body of the message sent before a revocation is issued, so both halves identify the same copy. */
export const SENT_BEFORE_REVOCATION = 'Sent before the revocation was issued';

/** Bodies straddling a proof rotation: which one keeps its Pro treatment is the assertion. */
export const SENT_ON_OLD_PROOF = 'Sent on the proof that was rotated away';
export const SENT_ON_NEW_PROOF = 'Sent on the replacement proof';

/**
 * Body of the message carrying a real proof the recipient cannot verify.
 *
 * "Fake" describes it from the RECIPIENT'S side, which is the side under test: the proof is genuinely
 * minted and genuinely signed, and the recipient simply trusts a different key, so it cannot tell this
 * from a forgery.
 */
export const SENT_WITH_FAKE_PROOF = 'Sent with a fake proof';

export const REVOCATION_EFFECTIVE_IN_SECONDS = 20;

/** How long a client is given to poll and act on a revocation once it has taken effect. */
export const REVOCATION_POLL_SETTLE_MS = 5000;

/**
 * How long the badge is given to appear before its absence is called a refusal.
 *
 * A settle-then-check rather than a poll-until-absent: the badge should never appear, and any assertion
 * returning on first sight of "no badge" passes before it would have rendered. The matching-key control
 * renders it ~2s after the message, so this is ~7x that.
 */
export const BADGE_SETTLE_MS = 15_000;
