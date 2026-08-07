/**
 * Creates, boots and snapshots the Android emulators the suite expects — the counterpart to
 * `create_ios_simulators.ts`, and the replacement for the old `scripts/ci.sh`.
 *
 *   pnpm create-emulators             # 4 emulators, cold boot (local default)
 *   pnpm create-emulators 1           # just the first, enough for @1-devices specs
 *   pnpm create-emulators --provision # CI only: install the SDK, then create the AVDs
 *   pnpm create-emulators --snapshot-save   # CI: snapshot booted emulators for fast restarts
 *   pnpm create-emulators --start-snapshots # CI: boot the fleet from those snapshots
 *   pnpm create-emulators --kill            # stop every running emulator
 *
 * Versions live in `android_config.ts` and nowhere else — see the note there about why they are
 * declared rather than detected.
 *
 * Why this exists rather than "create them in AVD Manager": four things about the manual route fail
 * silently or misleadingly.
 *
 * 1. **Ports are load-bearing.** `capabilities_android.ts` hardcodes the udids
 *    `emulator-5554/5556/5558/5560`, and an emulator started without `-port` simply takes the next
 *    free one — so a stray emulator shifts every device and the suite talks to the wrong one (or
 *    fails to find it). This pins them. (The old `ci.sh` relied on start order instead, which is why
 *    a leftover emulator on a CI worker could silently renumber the fleet.)
 * 2. **A half-created AVD looks valid.** `emulator -list-avds` reads the `.ini`, so an AVD whose
 *    `.avd` directory is empty (no `config.ini`) is listed as present and only fails at boot.
 * 3. **The device profile is not cosmetic.** The visual-regression baselines were captured on a
 *    Pixel 6 at API 34; another profile or API level fails screenshot comparisons for reasons that
 *    have nothing to do with the change under test.
 * 4. **The `.env` paths.** `getAdbFullPath()`/`getEmulatorFullPath()` throw naming the *variable*,
 *    which reads like "you forgot to set it" even when it is set to a path that doesn't exist.
 *
 * Deliberately uses its own `AVD_PREFIX` so it never touches a developer's hand-made AVDs.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import {
  AndroidPaths,
  AVD_RAM_MB,
  BASE_PORT,
  CMDLINE_TOOLS_ZIP,
  DEVICE_PROFILE,
  MAX_EMULATORS,
  resolvePaths,
  sdkPackages,
  systemImage,
} from './android_config';

const AVD_PREFIX = 'Session_QA';
const SNAPSHOT_NAME = 'qa.snapshot';

function avdName(index: number): string {
  return `${AVD_PREFIX}_${index + 1}`;
}

function portFor(index: number): number {
  return BASE_PORT + index * 2;
}

function run(cmd: string, opts: { input?: string } = {}): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
}

/** Inherits stdio: provisioning steps are slow and their progress is the only reassurance there is. */
function runVerbose(cmd: string, opts: { input?: string } = {}): void {
  execSync(cmd, { encoding: 'utf-8', stdio: 'inherit', ...opts });
}

function createAvd(paths: AndroidPaths, name: string): void {
  // `--force` overwrites an existing AVD of the same name, which also repairs the "listed but empty
  // .avd directory" case that AVD Manager can leave behind.
  // avdmanager prompts for a custom hardware profile unless it gets an answer on stdin.
  run(
    `"${paths.avdmanager}" create avd --name "${name}" --package "${systemImage()}" ` +
      `--device "${DEVICE_PROFILE}" --force`,
    { input: 'no\n' }
  );

  patchAvdConfig(name, {
    // The pixel_6 profile defaults the back camera to `emulated` (a synthetic moving pattern).
    // Appium's image injection works by swapping a poster texture in the emulator's *virtual scene*,
    // so without this the media specs get the default pattern instead of the image they injected — a
    // wrong-content failure rather than an obvious one. See scripts/setup_virtual_scene.ts.
    'hw.camera.back': 'virtualscene',
    'hw.ramSize': String(AVD_RAM_MB),
  });
}

/** Sets keys in an AVD's `config.ini`, replacing any existing entry for the same key. */
function patchAvdConfig(name: string, values: Record<string, string>): void {
  const configPath = join(homedir(), '.android', 'avd', `${name}.avd`, 'config.ini');
  if (!existsSync(configPath)) {
    throw new Error(`AVD config not found at ${configPath} — avdmanager did not create the AVD.`);
  }

  const lines = readFileSync(configPath, 'utf-8').split('\n');
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const index = lines.findIndex(l => l.trim().startsWith(`${key}=`));
    if (index >= 0) {
      lines[index] = line;
    } else {
      lines.push(line);
    }
  }
  writeFileSync(configPath, lines.join('\n'));
}

/**
 * Boots one emulator, detached.
 *
 * `-no-snapshot-load` forces a cold boot, so a snapshot taken on a different image can't resurrect
 * stale state (including a previously-persisted QaLaunchConfig network). `fromSnapshot` is the CI
 * path, where that state is exactly what we want back.
 *
 * `DISPLAY=:0` is set unconditionally on Linux: the CI workers are headless-with-Xvfb and the
 * emulator refuses to start a GPU-host session without it. It is meaningless and harmless elsewhere.
 */
function bootAvd(
  paths: AndroidPaths,
  name: string,
  port: number,
  { fromSnapshot = false } = {}
): void {
  const display = process.platform === 'linux' ? 'DISPLAY=:0 ' : '';
  const snapshotArgs = fromSnapshot
    ? `-no-snapshot-save -snapshot ${SNAPSHOT_NAME} -force-snapshot-load`
    : '-no-snapshot-load';

  execSync(
    `nohup ${display}"${paths.emulator}" @${name} -port ${port} ${snapshotArgs} -no-boot-anim ` +
      `> /tmp/emulator-${port}.log 2>&1 &`,
    { stdio: 'ignore' }
  );
}

function waitForBoot(paths: AndroidPaths, port: number, timeoutMs = 180_000): boolean {
  const serial = `emulator-${port}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const booted = run(
        `"${paths.adb}" -s ${serial} shell getprop sys.boot_completed 2>/dev/null`
      ).trim();
      if (booted === '1') {
        return true;
      }
    } catch {
      // Device not up yet — adb exits non-zero until the emulator registers.
    }
    run('sleep 2');
  }
  return false;
}

function updateLocalEnvFile(paths: AndroidPaths): void {
  const envPath = '.env';
  const values: Record<string, string> = {
    ANDROID_SDK_ROOT: paths.sdkRoot,
    APPIUM_ADB_FULL_PATH: paths.adb,
    EMULATOR_FULL_PATH: paths.emulator,
  };

  let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const lines = content.split('\n');

  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const index = lines.findIndex(l => l.trim().startsWith(`${key}=`));
    if (index >= 0) {
      lines[index] = line;
    } else {
      lines.push(line);
    }
  }

  content = lines.join('\n');
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  writeFileSync(envPath, content);
  console.log(`✓ Updated .env (${Object.keys(values).join(', ')})`);
}

/**
 * Installs the Android SDK on a bare CI worker. **Linux only, and needs sudo.**
 *
 * Run this when bumping the API level or adding a worker — not per build. Afterwards the emulators
 * still need creating and snapshotting; see the usage block at the top of this file.
 */
function provisionSdk(paths: AndroidPaths): void {
  if (process.platform !== 'linux') {
    throw new Error(
      `--provision targets the Linux CI workers, not ${process.platform}. On a developer machine, ` +
        `install the SDK through Android Studio instead.`
    );
  }

  const apt = [
    'ca-certificates curl git vim bash wget unzip tree htop gzip default-jre',
    'libnss3 libxcursor1 libqt5gui5 libc++-dev libxcb-cursor0 tar gh nload',
  ].join(' ');

  runVerbose('sudo apt update');
  runVerbose(`sudo apt install -y ${apt}`);

  runVerbose(`sudo rm -rf "${paths.sdkRoot}"`);
  runVerbose(`sudo mkdir -p "${paths.sdkRoot}"`);
  runVerbose(`sudo chown "$USER:$USER" "${paths.sdkRoot}"`);

  runVerbose(`wget -q https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP} -P /tmp`);
  runVerbose(`unzip -q -d "${paths.sdkRoot}" /tmp/${CMDLINE_TOOLS_ZIP}`);

  // The zip unpacks to cmdline-tools/{bin,lib,...}; sdkmanager insists on being one level deeper,
  // under a version directory. `latest` is the conventional name and is what resolvePaths expects.
  const cmdlineTools = join(paths.sdkRoot, 'cmdline-tools');
  runVerbose(`mkdir -p "${join(cmdlineTools, 'latest')}"`);
  runVerbose(
    `cd "${cmdlineTools}" && mv NOTICE.txt source.properties bin lib latest/ 2>/dev/null || true`
  );

  // `yes` rather than an interactive prompt: this runs unattended on a worker.
  runVerbose(`yes | "${paths.sdkmanager}" --licenses`);
  runVerbose(`yes | "${paths.sdkmanager}" --verbose ${sdkPackages().join(' ')}`);
  runVerbose(`yes | "${paths.sdkmanager}" emulator`);

  // adb must have run once to generate its key before an AVD is created, or the first boot pairs
  // against a key that doesn't exist yet.
  runVerbose(`"${paths.adb}" start-server`);
}

/**
 * Snapshots every running emulator so later runs can skip the cold boot.
 *
 * Let the fleet settle first — snapshotting mid-boot captures a half-started system that then has to
 * finish booting on every restore, which is slower than a cold boot and looks like flakiness.
 */
function saveSnapshots(paths: AndroidPaths, count: number): void {
  for (let i = 0; i < count; i++) {
    const serial = `emulator-${portFor(i)}`;
    process.stdout.write(`  ${serial} … `);
    runVerbose(`"${paths.adb}" -s ${serial} emu avd snapshot save ${SNAPSHOT_NAME}`);
    console.log('saved');
  }
}

function killEmulators(paths: AndroidPaths): void {
  for (let i = 0; i < MAX_EMULATORS; i++) {
    const serial = `emulator-${portFor(i)}`;
    try {
      run(`"${paths.adb}" -s ${serial} emu kill`);
      console.log(`  ✓ killed ${serial}`);
    } catch {
      // Not running — the desired end state either way.
    }
  }
}

function bootFleet(paths: AndroidPaths, count: number, { fromSnapshot = false } = {}): void {
  for (let i = 0; i < count; i++) {
    const name = avdName(i);
    const port = portFor(i);
    process.stdout.write(`  [${i + 1}/${count}] ${name} on port ${port} … `);
    bootAvd(paths, name, port, { fromSnapshot });
    console.log('booting');
  }

  console.log(
    `\nWaiting for boot${fromSnapshot ? ' (from snapshot)' : ' (cold boot takes a while)'}…`
  );
  const failed: string[] = [];
  for (let i = 0; i < count; i++) {
    const port = portFor(i);
    if (waitForBoot(paths, port)) {
      console.log(`  ✓ emulator-${port} booted`);
    } else {
      failed.push(`emulator-${port}`);
      console.log(
        `  ✗ emulator-${port} did not report boot_completed (see /tmp/emulator-${port}.log)`
      );
    }
  }

  if (failed.length > 0) {
    throw new Error(`Emulators failed to boot: ${failed.join(', ')}`);
  }
}

function parseCount(args: string[]): number {
  const positional = args.find(a => !a.startsWith('--'));
  const requested = Number(positional ?? MAX_EMULATORS);
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_EMULATORS) {
    throw new Error(
      `Emulator count must be 1-${MAX_EMULATORS} (the suite only declares ${MAX_EMULATORS} udids).`
    );
  }
  return requested;
}

function main(): void {
  const args = process.argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const count = parseCount(args);

  if (has('--kill')) {
    killEmulators(resolvePaths({ requireTools: false }));
    return;
  }

  if (has('--provision')) {
    const paths = resolvePaths({ requireTools: false });
    console.log(`Provisioning Android SDK at ${paths.sdkRoot}\n`);
    provisionSdk(paths);
    console.log('\n✓ SDK installed. Now run: pnpm create-emulators');
    return;
  }

  const paths = resolvePaths();

  if (has('--snapshot-save')) {
    console.log(`Saving "${SNAPSHOT_NAME}" for ${count} emulator(s)…`);
    saveSnapshots(paths, count);
    console.log(
      '\n✓ Snapshots saved. Boot from them with: pnpm create-emulators --start-snapshots'
    );
    return;
  }

  if (has('--start-snapshots')) {
    console.log(`Starting ${count} emulator(s) from "${SNAPSHOT_NAME}"\n`);
    bootFleet(paths, count, { fromSnapshot: true });
    console.log(`\n✓ ${count} emulator(s) ready`);
    return;
  }

  console.log(`Android SDK: ${paths.sdkRoot}`);
  console.log(`Creating ${count} x ${DEVICE_PROFILE} (${systemImage()})\n`);

  for (let i = 0; i < count; i++) {
    createAvd(paths, avdName(i));
  }

  bootFleet(paths, count);
  updateLocalEnvFile(paths);

  const started = Array.from({ length: count }, (_, i) => `emulator-${portFor(i)}`);
  console.log(`\n✓ ${started.length} emulator(s) ready: ${started.join(', ')}`);
  console.log(
    '\nNext: pnpm setup-virtual-scene   (camera image injection, needed by the media specs)'
  );
}

main();
