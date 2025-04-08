import { execSync, spawnSync } from 'child_process';
import { getSimulatorUDID, isSimulatorBooted } from './ios_shared';
import { sleep } from './shared';

const START_CHUNK = 6;
const MAX_SIMULATORS = 12;

function bootSimulator(udid: string, label: number) {
  try {
    console.log(`Booting simulator ${label}: ${udid}`);
    const result = execSync(`xcrun simctl boot ${udid}`, { stdio: 'pipe' }).toString();
    console.log(`Boot command output: ${result}`);
  } catch (error: any) {
    console.error(`Error: Boot command failed for ${udid}`);
    console.error(error.stderr?.toString() || error.message);
    return false;
  }

  return true;
}

async function startSimulatorsFromEnvIOS() {
  console.log("Starting iOS simulators from environment variables...");

  const simulators = [];
  for (let i = 1; i <= MAX_SIMULATORS; i++) {
    const udid = getSimulatorUDID(i);
    if (!udid) {
      throw new Error(`Error: Simulator ${i} (IOS_${i}_SIMULATOR) is not set`);
    }
    simulators.push({ label: i, udid });
  }

  for (let i = 0; i < simulators.length; i += START_CHUNK) {
    const chunk = simulators.slice(i, i + START_CHUNK);

    for (const sim of chunk) {
      const success = bootSimulator(sim.udid, sim.label);
      if (!success) throw new Error(`Failed to boot simulator with parameters: ${sim.udid}:${sim.label}`);
    }

    // Wait for simulators to boot
    await sleep(5000);

    for (const sim of chunk) {
      const booted = isSimulatorBooted(sim.udid);
      console.log(`Post-boot status for ${sim.udid}: ${booted ? 'Booted' : 'Not booted'}`);
      if (!booted) {
        console.error(`Error: Simulator ${sim.udid} did not boot successfully.`);
        return;
      }
    }
  }

  console.log("Opening iOS Simulator app...");
  spawnSync('open', ['-a', 'Simulator']);
}

startSimulatorsFromEnvIOS();
