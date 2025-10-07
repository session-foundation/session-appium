# Automation Testing for Session

Integration tests for Session app on iOS and Android using Playwright and Appium.

## Quick Start

1. **Install dependencies:**
   ```bash
   nvm use
   npm install -g yarn
   yarn install --immutable
   ```

2. **Install Git LFS:**
   ```bash
   # macOS
   brew install git-lfs
   
   # Linux
   sudo apt install git-lfs

   # Then
   git lfs install
   git lfs pull  # Ensure all LFS files are downloaded
   ```
3. **Setup environment:**
   ```bash
   cp .env.sample .env
   # Edit .env with your specific paths - see Environment Configuration below
   ```
4. **Run tests locally:**
   ```bash
   yarn start-server                        # Starts Appium server
   yarn test                                # Run all tests
   yarn test-android                        # Android tests only
   yarn test-ios                            # iOS tests only
   yarn test-one 'Test name'                # Run specific test (both platforms)
   yarn test-one 'Test name @android'       # Run specific test on one platform
   ```

## Local Development

Note: The tests use devices with specific resolutions for visual regression testing - ensure you have these available (see below).

### Android

Prerequisites: Android Studio installed with SDK tools available
1. Create 3x Pixel 6 emulators via AVD Manager (minimum 3 emulators - tests require up to 3 devices simultaneously)
    - Recommended system image is Android API 34 with Google Play services
2. Download Session binaries from [the build repository](https://oxen.rocks)
   - Choose the appropriate binary based on your network access:
     - QA: Works on general networks
     - AutomaticQA: Requires local devnet access
3. Set environment variable: 
   ```bash   
   # In your .env file
   ANDROID_APK=/path/to/session-android.apk
   ```
4. Start emulators manually - they need to be running before tests start (Appium won't launch them automatically)
   ```bash
   emulator @<your-emulator-name>
   ```

### iOS  
Prerequisites: Xcode installed

1. Create iOS simulators with preloaded media attachments:
   ```bash   
   # Local development (create 3 simulators to be able to run all tests)
   yarn create-simulators 3
   # Or specify custom count
   yarn create-simulators <number>
   ```
2. Download Session binaries from the [the build repository](https://oxen.rocks)
3. Extract .app file and copy Session.app to an easily accessible location
4. Set environment variable:

   ```bash   
   # In your .env file
   IOS_APP_PATH_PREFIX=/path/to/Session.app
   ```

### Environment Configuration

Copy `.env.sample` to `.env` and configure the following:

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
```

### Multiple ADB Binaries Warning

Having multiple adb installations can cause test instability. On Linux, ensure only the SDK version is available:

```bash
sudo apt remove adb android-tools-adb
which adb  # Should return nothing
```

## Test Organization

Tests are tagged with device requirements and risk levels:
- `@N-devices` - N-device tests (N = 1 || 2 || 3)
- `@high-risk`, `@medium-risk`, `@low-risk` - Risk-based test categorization
- `@android`, `@ios` - Platform-specific tests