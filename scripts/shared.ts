import { toNumber } from 'lodash';
import { execSync } from 'node:child_process';

export function sleepSync(seconds: number) {
  execSync(`sleep ${seconds} `);
}

export function killProcessByPort(port: number) {
  try {
    console.log(`About to kill process on port ${port}...`);
    const existingPid = execSync(`lsof -t -i :${port}`).toString();
    if (existingPid && toNumber(existingPid)) {
      process.kill(toNumber(existingPid));
    }
  } catch (error: any) {
    console.error(`Failed to kill any process on port ${port}`);
    console.error(error.stderr?.toString() || error.message);
    return false;
  }
}
