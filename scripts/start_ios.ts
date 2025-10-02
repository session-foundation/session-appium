import { spawnSync } from 'child_process';

import { bootSimulator, getChunkedSimulators, isSimulatorBooted } from './ios_shared';
import { sleepSync } from './shared';

const START_CHUNK = 12;

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
