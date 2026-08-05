/**
 * Creates and boots the Android emulators the suite expects — the counterpart to
 * `create_ios_simulators.ts`.
 *
 *   pnpm create-emulators        # 4 emulators (enough for every spec)
 *   pnpm create-emulators 1      # just the first, enough for @1-devices specs
 *
 * Why this exists rather than "create them in AVD Manager": four things about the manual route fail
 * silently or misleadingly.
 *
 * 1. **Ports are load-bearing.** `capabilities_android.ts` hardcodes the udids
 *    `emulator-5554/5556/5558/5560`, and an emulator started without `-port` simply takes the next
 *    free one — so a stray emulator shifts every device and the suite talks to the wrong one (or
 *    fails to find it). This pins them.
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

/** Must match `hw.device.name` expectations of the visual-regression baselines. */
const DEVICE_PROFILE = 'pixel_6';
/** API 34 (Android 14) — matches `appium:platformVersion: '14'` in capabilities_android.ts. */
const SYSTEM_IMAGE = 'system-images;android-34;google_apis_playstore;arm64-v8a';
const IMAGE_REL_PATH = join('system-images', 'android-34', 'google_apis_playstore', 'arm64-v8a');
const AVD_PREFIX = 'Session_QA';
/** The suite's first udid; each subsequent emulator is +2 (adb's console/adb port pairing). */
const BASE_PORT = 5554;
const MAX_EMULATORS = 4;

type Paths = { sdkRoot: string; adb: string; emulator: string; avdmanager: string };

function resolvePaths(): Paths {
  const sdkRoot =
    process.env.ANDROID_SDK_ROOT ??
    process.env.ANDROID_HOME ??
    join(homedir(), 'Library', 'Android', 'sdk');

  const paths: Paths = {
    sdkRoot,
    adb: join(sdkRoot, 'platform-tools', 'adb'),
    emulator: join(sdkRoot, 'emulator', 'emulator'),
    avdmanager: join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'avdmanager'),
  };

  if (!existsSync(paths.sdkRoot)) {
    throw new Error(`Android SDK not found at ${paths.sdkRoot}. Set ANDROID_SDK_ROOT.`);
  }
  if (!existsSync(paths.avdmanager)) {
    // The legacy copy at `tools/bin/avdmanager` is not a fallback: it needs javax.xml.bind, removed
    // in Java 11, so on any current JDK it dies with NoClassDefFoundError.
    throw new Error(
      `avdmanager not found at ${paths.avdmanager}.\n` +
        `Install "Android SDK Command-line Tools (latest)" via Android Studio > SDK Manager > SDK Tools.`
    );
  }
  if (!existsSync(join(paths.sdkRoot, IMAGE_REL_PATH, 'system.img'))) {
    throw new Error(
      `System image missing: ${SYSTEM_IMAGE}\n` +
        `Install it via Android Studio > SDK Manager > SDK Platforms > tick "Show Package Details" ` +
        `> Android 14.0 ("UpsideDownCake") > "Google Play ARM 64 v8a System Image".`
    );
  }
  return paths;
}

function run(cmd: string, opts: { input?: string } = {}): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
}

function createAvd(paths: Paths, name: string): void {
  // `--force` overwrites an existing AVD of the same name, which also repairs the "listed but empty
  // .avd directory" case that AVD Manager can leave behind.
  // avdmanager prompts for a custom hardware profile unless it gets an answer on stdin.
  run(
    `"${paths.avdmanager}" create avd --name "${name}" --package "${SYSTEM_IMAGE}" ` +
      `--device "${DEVICE_PROFILE}" --force`,
    { input: 'no\n' }
  );

  // The pixel_6 profile defaults the back camera to `emulated` (a synthetic moving pattern). Appium's
  // image injection works by swapping a poster texture in the emulator's *virtual scene*, so without
  // this the media specs get the default pattern instead of the image they injected — a wrong-content
  // failure rather than an obvious one. See scripts/setup_virtual_scene.ts, which supplies the
  // matching poster files.
  patchAvdConfig(name, { 'hw.camera.back': 'virtualscene' });
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

function bootAvd(paths: Paths, name: string, port: number): void {
  // Detached: the emulator runs for as long as the developer wants it, past this script exiting.
  // -no-snapshot-load forces a cold boot, so a snapshot taken on a different image can't resurrect
  // stale state (including a previously-persisted QaLaunchConfig network).
  execSync(
    `nohup "${paths.emulator}" @${name} -port ${port} -no-snapshot-load -no-boot-anim ` +
      `> /tmp/emulator-${port}.log 2>&1 &`,
    { stdio: 'ignore' }
  );
}

function waitForBoot(paths: Paths, port: number, timeoutMs = 180_000): boolean {
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

function updateLocalEnvFile(paths: Paths): void {
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

function main(): void {
  const requested = Number(process.argv[2] ?? MAX_EMULATORS);
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_EMULATORS) {
    throw new Error(
      `Emulator count must be 1-${MAX_EMULATORS} (the suite only declares ${MAX_EMULATORS} udids).`
    );
  }

  const paths = resolvePaths();
  console.log(`Android SDK: ${paths.sdkRoot}`);
  console.log(`Creating ${requested} x ${DEVICE_PROFILE} (${SYSTEM_IMAGE})\n`);

  const started: string[] = [];
  for (let i = 0; i < requested; i++) {
    const name = `${AVD_PREFIX}_${i + 1}`;
    const port = BASE_PORT + i * 2;

    process.stdout.write(`  [${i + 1}/${requested}] ${name} on port ${port} … `);
    createAvd(paths, name);
    bootAvd(paths, name, port);
    started.push(`emulator-${port}`);
    console.log('booting');
  }

  console.log('\nWaiting for boot (cold boot takes a while)…');
  const failed: string[] = [];
  for (let i = 0; i < requested; i++) {
    const port = BASE_PORT + i * 2;
    if (waitForBoot(paths, port)) {
      console.log(`  ✓ emulator-${port} booted`);
    } else {
      failed.push(`emulator-${port}`);
      console.log(
        `  ✗ emulator-${port} did not report boot_completed (see /tmp/emulator-${port}.log)`
      );
    }
  }

  updateLocalEnvFile(paths);

  if (failed.length > 0) {
    throw new Error(`Emulators failed to boot: ${failed.join(', ')}`);
  }

  console.log(`\n✓ ${started.length} emulator(s) ready: ${started.join(', ')}`);
  console.log(
    '\nNext: pnpm setup-virtual-scene   (camera image injection, needed by the media specs)'
  );
}

main();
