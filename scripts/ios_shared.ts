
import { execSync } from 'child_process';


export function getSimulatorUDID(index: number) {
  const envVar = `IOS_${index}_SIMULATOR`;
  return process.env[envVar];
}



export function isSimulatorBooted(udid: string) {
  try {
    const result = execSync(`xcrun simctl list devices booted`).toString();
    return result.includes(udid);
  } catch (error: any) {
    console.error("Error checking booted devices", error.message);
    return false;
  }
}



export function isAnySimulatorBooted() {
  try {
    const result = execSync(`xcrun simctl list devices booted`).toString();
    return result.includes("Booted");
  } catch (error: any) {
    console.error("Error checking booted devices", error.message);
    return false;
  }
}
