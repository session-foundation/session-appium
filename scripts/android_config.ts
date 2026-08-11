/**
 * Single source of truth for the Android SDK versions and device shape the suite expects.
 *
 * **Bump the versions here and nowhere else.** A second declaration anywhere — CI provisioning, the
 * local emulator script — drifts silently: the two fleets simply run different Android versions, and
 * the first symptom is a visual-regression diff or an API-specific behaviour change that reads as a
 * product bug.
 *
 * Deliberately declared rather than detected, matching how iOS handles the same problem: a version
 * bump is a reviewed edit, not something the script quietly follows the host into.
 */
import { existsSync } from 'fs';
import { arch, homedir, platform } from 'os';
import { join } from 'path';

/** Android 14. Must match `appium:platformVersion` in `capabilities_android.ts`. */
export const API_LEVEL = '34';
export const PLATFORM_VERSION = '14';
export const BUILD_TOOLS_VERSION = '34.0.0';

/**
 * `google_apis_playstore` rather than `google_apis`: the suite needs Play services present.
 *
 * Note this choice also decides that the image is a `-user` build, so `adb root` is unavailable and
 * CheckJNI cannot be enabled system-wide. If a JNI-level runtime check is ever wanted, this is the
 * line that has to change.
 */
export const SYSTEM_IMAGE_TARGET = 'google_apis_playstore';

/** The visual-regression baselines were captured on this profile; another one fails comparisons. */
export const DEVICE_PROFILE = 'pixel_6';

/** 4 GB. The profile default is not enough to run the app plus the UiAutomator2 server comfortably. */
export const AVD_RAM_MB = 4192;

/** The suite's first udid; each subsequent emulator is +2 (adb's console/adb port pairing). */
export const BASE_PORT = 5554;

/** `capabilities_android.ts` declares exactly this many udids. */
export const MAX_EMULATORS = 4;

/** The command-line tools bundle, used only when provisioning a CI machine from scratch. */
export const CMDLINE_TOOLS_ZIP = 'commandlinetools-linux-11076708_latest.zip';

/**
 * ABI for the host running the emulator.
 *
 * The one value that legitimately differs between the two fleets: CI is x86_64 Linux, developer
 * machines are Apple Silicon. Detected rather than declared because it is a property of the host, not
 * a choice — and getting it wrong doesn't drift, it fails immediately with no matching system image.
 */
export function hostAbi(): string {
  return arch() === 'arm64' ? 'arm64-v8a' : 'x86_64';
}

export function systemImage(abi: string = hostAbi()): string {
  return `system-images;android-${API_LEVEL};${SYSTEM_IMAGE_TARGET};${abi}`;
}

/** Path of the system image inside the SDK root, for presence checks. */
export function systemImageRelPath(abi: string = hostAbi()): string {
  return join('system-images', `android-${API_LEVEL}`, SYSTEM_IMAGE_TARGET, abi);
}

/** Everything `sdkmanager` needs to install on a bare CI machine. */
export function sdkPackages(abi: string = hostAbi()): string[] {
  return [
    systemImage(abi),
    `platforms;android-${API_LEVEL}`,
    `build-tools;${BUILD_TOOLS_VERSION}`,
    'platform-tools',
  ];
}

export type AndroidPaths = {
  sdkRoot: string;
  adb: string;
  emulator: string;
  avdmanager: string;
  sdkmanager: string;
};

/**
 * Where the SDK lives.
 *
 * CI sets `ANDROID_SDK_ROOT=/opt/android`; locally it defaults to the Android Studio location. The
 * env var wins either way, so the same code serves both without branching on platform.
 */
export function resolvePaths({ requireTools = true } = {}): AndroidPaths {
  const sdkRoot =
    process.env.ANDROID_SDK_ROOT ??
    process.env.ANDROID_HOME ??
    (platform() === 'darwin'
      ? join(homedir(), 'Library', 'Android', 'sdk')
      : join('/opt', 'android'));

  const paths: AndroidPaths = {
    sdkRoot,
    adb: join(sdkRoot, 'platform-tools', 'adb'),
    emulator: join(sdkRoot, 'emulator', 'emulator'),
    avdmanager: join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'avdmanager'),
    sdkmanager: join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'),
  };

  // Skipped when provisioning, where the whole point is that none of this exists yet.
  if (!requireTools) {
    return paths;
  }

  if (!existsSync(paths.sdkRoot)) {
    throw new Error(`Android SDK not found at ${paths.sdkRoot}. Set ANDROID_SDK_ROOT.`);
  }
  if (!existsSync(paths.avdmanager)) {
    // The legacy copy at `tools/bin/avdmanager` is not a fallback: it needs javax.xml.bind, removed
    // in Java 11, so on any current JDK it dies with NoClassDefFoundError.
    throw new Error(
      `avdmanager not found at ${paths.avdmanager}.\n` +
        `Install "Android SDK Command-line Tools (latest)" via Android Studio > SDK Manager > SDK Tools,\n` +
        `or run: pnpm create-emulators --provision   (CI machines only)`
    );
  }
  if (!existsSync(join(paths.sdkRoot, systemImageRelPath(), 'system.img'))) {
    throw new Error(
      `System image missing: ${systemImage()}\n` +
        `Install it via Android Studio > SDK Manager > SDK Platforms > tick "Show Package Details" ` +
        `> Android ${PLATFORM_VERSION}.0 > the "Google Play" image for your ABI.`
    );
  }
  return paths;
}
