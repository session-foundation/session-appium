# Automated Testing for Session Mobile

This repository holds the code to run integration tests for Session iOS and Android.

## Quick Start

### Prerequisites

- Node.js 24.12.0
- pnpm 10.28.1 
- Git LFS

```bash
pnpm install --frozen-lockfile
git lfs install && git lfs pull
git submodule update --init --recursive
```

### Running tests

```bash
pnpm start-server                        # Starts Appium server
pnpm test                                # Run all tests
pnpm test-android                        # Android tests only
pnpm test-ios                            # iOS tests only
pnpm test-one 'Test name'                # Run specific test (both platforms)
pnpm test-one 'Test name @android'       # Run specific test on one platform
```

## Local Development

Note: The tests use devices with specific resolutions for visual regression testing - ensure you have these available (see below).

### Android

Prerequisites: Android Studio installed with SDK tools available
1. Create 4x Pixel 6 emulators via AVD Manager (minimum 4 emulators - tests require up to 4 devices simultaneously)
    - Recommended system image is Android API 34 with Google Play services
   - Emulator names are not significant. The tests discover running emulators automatically.
2. Configure the emulators' virtual scene to enable custom image injection to camera viewport
    ```bash
    pnpm setup-virtual-scene
    ```
3. Download Session binaries from [the build repository](https://oxen.rocks)
   - Choose the appropriate binary based on your network access:
     - QA: Pre-configured to mainnet, can run on any network
     - AutomaticQA: Pre-configured to a local devnet, must have access
4. Set environment variable: 
   ```bash   
   # In your .env file
   ANDROID_APK=/path/to/session-android.apk
   ```
5. Start emulators manually - they need to be running before tests start (Appium won't launch them automatically)
   ```bash
   emulator @<your-emulator-name>
   ```

### iOS  
Prerequisites: Xcode installed and the appropriate simulator runtime available - check in `scripts/create_ios_simulators.ts`

1. Create iOS simulators with preloaded media attachments:
   ```bash   
   # Local development (create 4 simulators to be able to run all tests)
   pnpm create-simulators 4
   # Or specify custom count
   pnpm create-simulators <number>
   ```
2. Download Session binaries from the [the build repository](https://oxen.rocks)
3. Extract .app file and copy Session.app to an easily accessible location
4. Set environment variable:

   ```bash   
   # In your .env file
   IOS_APP_PATH_PREFIX=/path/to/Session.app
   ```

### Environment Configuration

```bash
cp .env.sample .env
```

**Required paths:**
```bash
ANDROID_SDK_ROOT=/path/to/Android/Sdk          # SDK tools auto-discovered from here
ANDROID_APK=/path/to/session-android.apk       # Android APK for testing
IOS_APP_PATH_PREFIX=/path/to/Session.app       # iOS app for testing
```

**Test configuration:**
```bash
_TESTING=1                           # Skip printing appium/wdio logs
PLAYWRIGHT_RETRIES_COUNT=0           # Test retry attempts
PLAYWRIGHT_REPEAT_COUNT=0            # Successful test repeat count
PLAYWRIGHT_WORKERS_COUNT=1           # Parallel test workers
CI=0                                 # Set to 1 to simulate CI (mostly for Allure reporting)
ALLURE_ENABLED='false'               # Set to 'true' to generate Allure reports (in conjunction with CI=1)
UPDATE_BASELINES=1                   # Auto-save new screenshot baselines if unavailable
SOGS_ADMIN_SEED='word1 word2...'     # 13-word recovery phrase of an account that's an admin in the testing SOGS. 
```
