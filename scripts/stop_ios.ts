import { execSync } from 'child_process';

import { isAnySimulatorBooted } from './ios_shared';

function stopSimulatorsFromEnvIOS() {
  console.log('Stopping all iOS simulators');
  execSync(`xcrun simctl shutdown "all"`).toString();
  if (isAnySimulatorBooted()) {
    execSync(`xcrun simctl shutdown "all"`).toString();
    execSync(`osascript -e 'tell application "Simulator" to quit'`).toString(); // We need to quit the simulator app to avoid it to restart the simulators
    execSync(`killall Simulator`).toString();
  }
  if (isAnySimulatorBooted()) {
    throw new Error('Failed to kill all running simulators');
  }

  console.log('All iOS simulators closed...');
}

stopSimulatorsFromEnvIOS();
