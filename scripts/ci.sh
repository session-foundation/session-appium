#!/bin/bash
set -x
# Android functions

ARCH="x86_64"
TARGET="google_apis_playstore"
API_LEVEL="34"
BUILD_TOOLS="34.0.0"
ANDROID_ARCH=${ANDROID_ARCH_DEFAULT}
ANDROID_API_LEVEL="android-${API_LEVEL}"
ANDROID_APIS="${TARGET};${ARCH}"
EMULATOR_PACKAGE="system-images;${ANDROID_API_LEVEL};${ANDROID_APIS}"
PLATFORM_VERSION="platforms;${ANDROID_API_LEVEL}"
BUILD_TOOL="build-tools;${BUILD_TOOLS}"
ANDROID_CMD="commandlinetools-linux-11076708_latest.zip"
export ANDROID_SDK_PACKAGES="${EMULATOR_PACKAGE} ${PLATFORM_VERSION} ${BUILD_TOOL} platform-tools"
export ANDROID_SDK_ROOT=/opt/android

export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/tools:$ANDROID_SDK_ROOT/cmdline-tools/tools/bin:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/tools/bin:$ANDROID_SDK_ROOT/latform-tools:$ANDROID_SDK_ROOT/build-tools/${BUILD_TOOLS}:$ANDROID_SDK_ROOT/platform-tools/"
export EMULATOR_DEVICE="pixel_6" # all emulators are created with the pixel 6 spec for now


# this should only be done when we bump the API version or add a worker to the CI that needs emulators to be setup
# Once you've run this, you must also start_for_snapshots() and force_save_snapshots() (see details below)
function create_emulators() {
    sudo apt update
    sudo apt install -y ca-certificates curl git  vim bash wget unzip tree htop gzip default-jre libnss3 libxcursor1 libqt5gui5 libc++-dev libxcb-cursor0 htop tree tar gzip gh nload

    sudo rm -rf $ANDROID_SDK_ROOT

    sudo mkdir -p $ANDROID_SDK_ROOT
    sudo chown $USER:$USER $ANDROID_SDK_ROOT

    wget https://dl.google.com/android/repository/${ANDROID_CMD} -P /tmp && \
                unzip -d $ANDROID_SDK_ROOT /tmp/$ANDROID_CMD && \
                mkdir -p $ANDROID_SDK_ROOT/cmdline-tools/tools && cd $ANDROID_SDK_ROOT/cmdline-tools &&  mv NOTICE.txt source.properties bin lib tools/  && \
                cd $ANDROID_SDK_ROOT/cmdline-tools/tools && ls

    yes Y | sdkmanager --licenses
    yes Y | sdkmanager --verbose --no_https ${ANDROID_SDK_PACKAGES}


    adb devices


    yes | sdkmanager emulator

    # make sure to start-adb at least once so it generates a key before we create the avd

    adb start-server

    for i in {1..4}
    do
        echo "no" | avdmanager --verbose create avd --force --name "emulator$i" --device "${EMULATOR_DEVICE}" --package "${EMULATOR_PACKAGE}"
        # Path to the AVD's config.ini file
        CONFIG_FILE="$HOME/.android/avd/emulator$i.avd/config.ini"

        # Set the RAM size to 6GB (6144MB)
        sed -i 's/^hw\.ramSize=.*/hw.ramSize=6144/' "$CONFIG_FILE"

    done

    cd
}

function start_for_snapshots() {
    for i in {1..4}
    do
        DISPLAY=:0 emulator @emulator$i -gpu host -accel on -no-snapshot-load  &
        sleep 20
    done
}

# let the emulators start and be ready (check cpu usage) before calling this.
# We want to take a snapshot woth emulators state as "done" as we can
function force_save_snapshots() {
    values=("5554" "5556" "5558" "5560" "5562" "5564" "5566" "5568")
    for val in "${values[@]}"
    do
        adb -s emulator-$val emu avd snapshot save plop.snapshot
    done
}

function killall_emulators() {
    killall qemu-system-x86_64;
}


function start_with_snapshots() {
    for i in {1..4}
    do
        EMU_CONFIG_FILE="$HOME/.android/avd/emulator$i.avd/emulator-user.ini"
        # set the position fo each emulator to be next to the previous one
        sed -i "s/^window.x.*/window.x=$(( 100 + (i-1) * 400))/" "$EMU_CONFIG_FILE"

        DISPLAY=:0 emulator @emulator$i -gpu host -accel on -no-snapshot-save -snapshot plop.snapshot  -force-snapshot-load &
        sleep 5
    done
}

# iOS functions

SIMULATOR_DEVICE="iPhone 15 Pro Max"
SIMULATOR_OS="18.2"

# Function to boot simulators from environment variables
function start_simulators_from_env_iOS() {
  echo "Starting iOS simulators from environment variables"


  for i in {1..12}; do
    simulator_label=$i
    env_var="IOS_${simulator_label}_SIMULATOR"
    simulator_udid=$(printenv "$env_var")

    echo "Iteration $i: Label: $simulator_label, Env var: $env_var, UDID: $simulator_udid"

    if [[ -n "$simulator_udid" ]]; then

      echo "Booting $simulator_label simulator: $simulator_udid"
      boot_output=$(xcrun simctl boot "$simulator_udid" 2>&1)
      boot_status=$?
      echo "Boot command output: $boot_output"
      echo "Boot command exit code: $boot_status"
      if [[ $boot_status -ne 0 ]]; then
        echo "Error: Boot command failed for $simulator_udid"
        return 101
      fi
      sleep 5

      booted=$(xcrun simctl list devices booted | grep "$simulator_udid")
      echo "Post-boot status for $simulator_udid: $booted"
      if [[ -z "$booted" ]]; then
        echo "Error: Simulator $simulator_udid did not boot successfully."
        return 102
      fi
    else
      echo "Error: $simulator_label simulator (env var $env_var) is not set"
      return 104
    fi
  done

  echo "Opening iOS Simulator app..."
  open -a Simulator

}




# Function to stop running simulators
function stop_simulators_from_env_iOS() {
    echo "Stopping iOS simulators from environment variables..."
    xcrun simctl shutdown all

}