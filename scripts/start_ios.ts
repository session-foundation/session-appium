import { execSync, spawnSync } from 'child_process';
import { getChunkedSimulators, isSimulatorBooted } from './ios_shared';
import { sleepSync } from './shared';

const START_CHUNK = 12;

function bootSimulator(udid: string, label: number) {
  try {
    console.log(`Booting simulator ${label}: ${udid}`);
    execSync(`xcrun simctl boot ${udid}`, { stdio: 'inherit' });
  } catch (error: any) {
    console.error(`Error: Boot command failed for ${udid}`);
    console.error(error.stderr?.toString() || error.message);
    return false;
  }

  return true;
}

function startSimulatorsFromEnvIOS() {
  console.log('Starting iOS simulators from environment variables...');

  const chunks = getChunkedSimulators(START_CHUNK);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    for (const sim of chunk) {
      const success = bootSimulator(sim.udid, sim.index);
      if (!success)
        throw new Error(`Failed to boot simulator with parameters: ${sim.udid}:${sim.index}`);
    }

    // Wait for simulators to boot
    sleepSync(10);

    for (const sim of chunk) {
      const booted = isSimulatorBooted(sim.udid);
      console.log(`Post-boot status for ${sim.udid}: ${booted ? 'Booted' : 'Not booted'}`);
      if (!booted) {
        console.error(`Error: Simulator ${sim.udid} did not boot successfully.`);
        return;
      }
    }
  }

  console.log('Opening iOS Simulator app...');

  spawnSync('open', ['-a', 'Simulator']);
}

startSimulatorsFromEnvIOS();
