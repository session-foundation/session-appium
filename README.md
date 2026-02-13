# Automation testing for Session

This repository holds the code to do integration tests with Appium and Session on iOS and Android.

# Setup

## Android SDK & Emulators

First, you need to download android studio at https://developer.android.com/studio.

Once installed, run it, open the SDK Manager and install the latest SDK tools.

Once this is done, open up the AVD Manager, click on "Create Device" -> "Pixel 6" -> Next -> Select the System Image you want (I did my tests with **UpsideDownCake**), install it, select it, "Next" and "Finish".

Then, create a second emulator following the exact same steps (the tests need 2 different emulators to run).

Once done, you should be able to start each emulators and have them running at the same time. They will need to be running for the tests to work, because Appium won't start them.

## Environment variables needed

Before you can start the tests, you need to setup some environment variables. See the file .env.sample for an example.

#### ANDROID_SDK_ROOT

`ANDROID_SDK_ROOT` should point to the folder containing the sdks, so the folder containing folders like `platform-tools`, `system-images`, etc...
`export ANDROID_SDK_ROOT=~/Android/Sdk`

#### APPIUM_ANDROID_BINARIES_ROOT

`APPIUM_ANDROID_BINARIES_ROOT` should point to the file containing the apks to install for testing (such as `session-1.18.2-x86.apk`)
`export APPIUM_ANDROID_BINARIES_ROOT=~/appium-binaries`

#### APPIUM_ADB_FULL_PATH

`APPIUM_ADB_FULL_PATH` should point to the binary of adb inside the ANDROID_SDK folder
`export APPIUM_ADB_FULL_PATH=~/Android/Sdk/platform-tools/adb`

### Multiple adb binaries

Having multiple adb on your system will make tests unreliable, because the server will be restarted by Appium.

On linux, if running `which adb` does not point to the `adb` binary in the `ANDROID_SDK_ROOT` you will have issues.

You can get rid of adb on linux by running

```
sudo apt remove adb
sudo apt remove android-tools-adb
```

`which adb` should not return anything.

Somehow, Appium asks for the sdk tools but do not force the adb binary to come from the sdk tools folder. Making sure that there is no adb in your path should solve this.

## Running tests on iOS Emulators

First you need to get correct branch of Session that you want to test from Github. See [(https://github.com/session-foundation/session-ios/releases/)] and download the latest **ipa** under **Assets**

Then to access the **.app** file that Appium needs for testing you need to build in Xcode and then find .app in your **Derived Data** folder for Xcode.

For Mac users this file will exist in:

Macintosh HD > Username > Library > Developer > Xcode > Derived Data > (Then there will be a version of Session with a very long line of letters) > Build > Products > App store-iphonesimulator > Session.app

Then Copy and Paste then app file onto Desktop (or anywhere you can access easily) then each time you build, navigate back to the file in Derived Data and copy and paste back to Desktop.
Then set the path to Session.app in your ios capabilities file.

## Appium & tests setup

First, install nvm for your system (https://github.com/nvm-sh/nvm).
For windows, head here: https://github.com/coreybutler/nvm-windows
For Mac, https://github.com/nvm-sh/nvm

You can check the current node version in `.tool-versions`
```
nvm install
nvm use
git lfs install
git lfs pull
git submodule update --init --recursive --remote
pnpm install --frozen-lockfile
```

Then, choose an option:

```
pnpm tsc # Build typescript files
pnpm run test # Run all the tests

Platform specific
pnpm run test-android # To run just Android tests
pnpm run test-ios # To run just iOS tests

pnpm run test-one 'Name of test' # To run one test (on both platforms)
pnpm run test-one 'Name of test android/ios' # To run one test on either platform
```
