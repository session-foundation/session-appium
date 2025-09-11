#!/bin/bash
set -x
# Android functions

# Common configuration
TARGET="google_apis_playstore"
EMULATOR_DEVICE="pixel_6"
EMULATOR_BIN="emulator" 

# Platform-specific configuration
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac ARM64 settings
    ARCH="arm64-v8a"
    EMULATOR_COUNT=6
    API_LEVEL="35"
    ANDROID_CMD="commandlinetools-mac-13114758_latest.zip"
    ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-"$HOME/Android/sdk"}
    RAM_SIZE="2048"
    EMULATOR_PROCESS="qemu-system-aarch64-headless"
else
    # Linux x86_64 settings
    ARCH="x86_64"
    EMULATOR_COUNT=4
    API_LEVEL="34"
    ANDROID_CMD="commandlinetools-linux-13114758_latest.zip"
    ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-"/opt/android"}
    RAM_SIZE="4192"
    EMULATOR_PROCESS="qemu-system-x86_64"
fi

# Derived configuration (uses the variables set above)
BUILD_TOOLS="${API_LEVEL}.0.0"
ANDROID_API_LEVEL="android-${API_LEVEL}"
EMULATOR_PACKAGE="system-images;${ANDROID_API_LEVEL};${TARGET};${ARCH}"
PLATFORM_VERSION="platforms;${ANDROID_API_LEVEL}"
BUILD_TOOL="build-tools;${BUILD_TOOLS}"
ANDROID_SDK_PACKAGES="${EMULATOR_PACKAGE} ${PLATFORM_VERSION} ${BUILD_TOOL} platform-tools emulator"

# Export everything
export ARCH EMULATOR_BIN EMULATOR_COUNT EMULATOR_PROCESS API_LEVEL ANDROID_CMD TARGET ANDROID_SDK_ROOT RAM_SIZE
export BUILD_TOOLS ANDROID_API_LEVEL EMULATOR_PACKAGE PLATFORM_VERSION BUILD_TOOL ANDROID_SDK_PACKAGES EMULATOR_DEVICE
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/tools/bin:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/build-tools/${BUILD_TOOLS}:$PATH"


# this should only be done when we bump the API version or add a worker to the CI that needs emulators to be setup
# Once you've run this, you must also start_for_snapshots() and force_save_snapshots() (see details below)
function create_emulators() {
    # Skip apt install on Mac
    if [[ "$OSTYPE" != "darwin"* ]]; then
        sudo apt update
        sudo apt install -y ca-certificates curl git vim bash wget unzip tree htop gzip default-jre libnss3 libxcursor1 libqt5gui5 libc++-dev libxcb-cursor0 tar gh nload
    fi

    sudo rm -rf $ANDROID_SDK_ROOT
    sudo mkdir -p $ANDROID_SDK_ROOT

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sudo chown $USER:staff $ANDROID_SDK_ROOT
    else
        sudo chown $USER:$USER $ANDROID_SDK_ROOT
    fi

    # Download SDK tools
    local download_url="https://dl.google.com/android/repository/${ANDROID_CMD}"
    echo "Downloading Android SDK tools..."
    curl -fL -o "/tmp/${ANDROID_CMD}" "$download_url"

    if [[ ! -f "/tmp/${ANDROID_CMD}" ]]; then
        echo "Error: Failed to download Android SDK tools" >&2
        return 1
    fi

    # Extract and setup
    unzip -d $ANDROID_SDK_ROOT /tmp/$ANDROID_CMD && \
    mkdir -p $ANDROID_SDK_ROOT/cmdline-tools/tools && \
    cd $ANDROID_SDK_ROOT/cmdline-tools && \
    mv NOTICE.txt source.properties bin lib tools/ && \
    cd $ANDROID_SDK_ROOT/cmdline-tools/tools && \
    ls

    yes Y | sdkmanager --licenses
    yes Y | sdkmanager --verbose --no_https ${ANDROID_SDK_PACKAGES}


    adb devices


    yes | sdkmanager emulator

    # make sure to start-adb at least once so it generates a key before we create the avd

    adb start-server

    for i in $(seq 1 $EMULATOR_COUNT)
    do
        echo "no" | avdmanager --verbose create avd --force --name "emulator$i" --device "${EMULATOR_DEVICE}" --package "${EMULATOR_PACKAGE}"
        
        # Configure RAM for each AVD
        local config_file="$HOME/.android/avd/emulator$i.avd/config.ini"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^hw\.ramSize=.*/hw.ramSize=${RAM_SIZE}/" "$config_file"
        else
            sed -i "s/^hw\.ramSize=.*/hw.ramSize=${RAM_SIZE}/" "$config_file"
        fi
    done
}

function start_for_snapshots() {
    for i in $(seq 1 $EMULATOR_COUNT)
    do
        $EMULATOR_BIN @emulator$i -gpu host -accel on -no-snapshot-load &
        sleep 20
    done
}

# let the emulators start and be ready (check cpu usage) before calling this.
# We want to take a snapshot woth emulators state as "done" as we can
function force_save_snapshots() {
    # Dynamic port generation based on emulator count
    for i in $(seq 1 $EMULATOR_COUNT)
    do
        port=$((5554 + (i-1)*2))
        adb -s emulator-$port emu avd snapshot save plop.snapshot
    done
}

function killall_emulators() {
    killall "$EMULATOR_PROCESS" 2>/dev/null || true
}


function start_with_snapshots() {
    for i in $(seq 1 $EMULATOR_COUNT); do
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # Mac: Headless with 9 emulators
            $EMULATOR_BIN @emulator$i \
                -no-window \
                -no-snapshot-save \
                -snapshot plop.snapshot \
                -force-snapshot-load &
        else
            # Linux: Keep as-is
            EMU_CONFIG_FILE="$HOME/.android/avd/emulator$i.avd/emulator-user.ini"
            sed -i "s/^window.x.*/window.x=$(( 100 + (i-1) * 400))/" "$EMU_CONFIG_FILE"
            DISPLAY=:0 $EMULATOR_BIN @emulator$i -gpu host -accel on -no-snapshot-save -snapshot plop.snapshot -force-snapshot-load &
        fi
        
        sleep 5
    done
}

function wait_for_emulators() {
    for i in $(seq 1 $EMULATOR_COUNT)
    do
        port=$((5554 + (i-1)*2))
        for j in {1..60}; do
            if adb -s emulator-$port shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
                echo "emulator-$port booted"
                break
            else
                echo "Waiting for emulator-$port to boot..."
                sleep 5
            fi
        done
    done
}


set +x