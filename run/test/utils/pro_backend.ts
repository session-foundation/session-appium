/**
 * The QA Pro backend to point the *clients* at, or `undefined` to leave them on the compiled-in one.
 *
 * Reads what `resolveDevnetServices` discovered (`devnet_services.ts`): it probes the backend, checks
 * the port really holds one, validates the key, and only then publishes `TEST_PRO_BACKEND_URL`. So
 * there is nothing to re-validate here — this only decides whether the clients are told about it.
 *
 * `TEST_PRO_BACKEND` is the on/off switch, matching Desktop (`cross_platform.ts` sets it), so a run
 * that merely *has* a local backend running does not silently redirect every client onto it.
 *
 * Both values travel together or not at all: the pubkey is what libSession verifies other users'
 * proofs against, so a device given the QA URL but left on the production key reads a QA-signed proof
 * as invalid, strips the Pro content and stores the sender as non-Pro — which looks like an app bug
 * rather than a harness gap.
 */
export function getProBackendOverride(): { url: string; pubkey: string } | undefined {
  if (!(process.env.TEST_PRO_BACKEND ?? '').trim()) {
    return undefined;
  }

  const url = (process.env.TEST_PRO_BACKEND_URL ?? '').trim();
  const pubkey = (process.env.TEST_PRO_BACKEND_ED_PK ?? '').trim();
  if (!url || !pubkey) {
    return undefined;
  }

  return { url, pubkey };
}
