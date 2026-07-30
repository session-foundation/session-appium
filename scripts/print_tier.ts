/**
 * Emits a parallelism tier as plain text so CI can drive its passes from the same table the local
 * runner uses, instead of a second copy of the numbers living in YAML.
 *
 * Usage:
 *   npx ts-node scripts/print_tier.ts ci           # one "<devices> <workers>" line per pass
 *   npx ts-node scripts/print_tier.ts ci --sims    # simulators the tier needs (largest pass)
 *
 * Intentionally imports nothing but the tier table: modules such as capabilities_ios log banners on
 * import, and anything on stdout here would be parsed as data by the caller.
 */
import {
  PARALLEL_TIER_NAMES,
  PARALLEL_TIERS,
  type ParallelTierName,
  simulatorsRequired,
} from '../run/constants/parallelism';

function main(): void {
  const argv = process.argv.slice(2);
  const name = argv.find(a => !a.startsWith('--'));
  const wantSims = argv.includes('--sims');

  if (!name || !PARALLEL_TIER_NAMES.includes(name as ParallelTierName)) {
    // stderr, so a caller capturing stdout gets nothing rather than an error string as data.
    console.error(
      `Usage: print_tier.ts <${PARALLEL_TIER_NAMES.join('|')}> [--sims]\n` +
        (name ? `Unknown tier "${name}".` : 'No tier given.')
    );
    process.exit(1);
  }

  const tier = PARALLEL_TIERS[name as ParallelTierName];

  if (wantSims) {
    console.log(String(simulatorsRequired(tier)));
    return;
  }

  for (const pass of tier.passes) {
    console.log(`${pass.devices} ${pass.workers}`);
  }
}

main();
