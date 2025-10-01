import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

type Simulator = {
  name: string;
  udid: string;
  wdaPort: number;
  index: number;
};

function cleanupIOSSimulators() {
  const jsonPath = 'ios-simulators.json';
  const envPath = '.env';

  console.log('\n========================================');
  console.log('Cleaning up iOS simulators');
  console.log('========================================\n');

  // Check for JSON file (CI)
  if (existsSync(jsonPath)) {
    const simulators: Simulator[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    console.log(`Found ${simulators.length} simulators in ios-simulators.json\n`);

    for (const sim of simulators) {
      try {
        console.log(`[${sim.index}] Deleting: ${sim.name}`);

        // Try to shutdown first (ignore errors if already shutdown)
        try {
          execSync(`xcrun simctl shutdown ${sim.udid}`, { stdio: 'pipe' });
        } catch {
          // Already shutdown, that's fine
        }

        // Delete the simulator
        execSync(`xcrun simctl delete ${sim.udid}`, { stdio: 'pipe' });
        console.log(`  ✓ Deleted ${sim.udid}\n`);
      } catch (error) {
        console.warn(`  ⚠ Failed to delete simulator ${sim.udid}`);
      }
    }

    // Remove the JSON file
    unlinkSync(jsonPath);
    console.log('✓ Removed ios-simulators.json\n');
  }

  // Check for simulators in .env (local)
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    const simulatorLines = envContent
      .split('\n')
      .filter(line => line.trim().startsWith('IOS_') && line.includes('_SIMULATOR='));

    if (simulatorLines.length > 0) {
      console.log(`Found ${simulatorLines.length} simulator UDIDs in .env\n`);

      const udids = simulatorLines
        .map(line => {
          const match = line.match(/IOS_\d+_SIMULATOR=(.+)/);
          return match ? match[1].trim() : null;
        })
        .filter((udid): udid is string => udid !== null);

      for (const udid of udids) {
        try {
          console.log(`Deleting: ${udid}`);

          // Try to shutdown first
          try {
            execSync(`xcrun simctl shutdown ${udid}`, { stdio: 'pipe' });
          } catch {
            // Already shutdown
          }

          // Delete the simulator
          execSync(`xcrun simctl delete ${udid}`, { stdio: 'pipe' });
          console.log(`  ✓ Deleted\n`);
        } catch (error) {
          console.warn(`  ⚠ Failed to delete ${udid}\n`);
        }
      }

      // Remove simulator lines from .env
      const cleanedEnv =
        envContent
          .split('\n')
          .filter(line => {
            const isSimLine = line.trim().startsWith('IOS_') && line.includes('_SIMULATOR=');
            const isSimComment = line.trim().startsWith('# iOS Simulators');
            return !isSimLine && !isSimComment;
          })
          .join('\n')
          .trim() + '\n';

      writeFileSync(envPath, cleanedEnv);
      console.log('✓ Removed simulator UDIDs from .env\n');
    }
  }

  if (
    !existsSync(jsonPath) &&
    (!existsSync(envPath) || !readFileSync(envPath, 'utf-8').includes('IOS_'))
  ) {
    console.log('No simulators found to clean up\n');
  }

  console.log('========================================');
  console.log('Cleanup complete');
  console.log('========================================\n');
}

cleanupIOSSimulators();
