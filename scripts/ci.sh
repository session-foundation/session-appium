#!/bin/bash
set -x
# Android functions

# Detect platform and set variables accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac settings
    ARCH="arm64-v8a"
    EMULATOR_COUNT=6
    API_LEVEL="35"
    ANDROID_CMD="commandlinetools-mac-13114758_latest.zip"
    EMULATOR_BIN="emulator"
    TARGET="google_apis_playstore"  # Mac ARM doesn't have playstore variant
    ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-"$HOME/Android/sdk"}
else
    # Linux settings
    ARCH="x86_64"
    EMULATOR_COUNT=4
    API_LEVEL="34"
    ANDROID_CMD="commandlinetools-linux-13114758_latest.zip"
    EMULATOR_BIN="emulator"
    TARGET="google_apis_playstore"  # Linux can use playstore
    ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-"/opt/android"}
fi


# Derive build tools version from API level
BUILD_TOOLS="${API_LEVEL}.0.0"
ANDROID_ARCH=${ANDROID_ARCH_DEFAULT}
ANDROID_API_LEVEL="android-${API_LEVEL}"
ANDROID_APIS="${TARGET};${ARCH}"
EMULATOR_PACKAGE="system-images;${ANDROID_API_LEVEL};${ANDROID_APIS}"
PLATFORM_VERSION="platforms;${ANDROID_API_LEVEL}"
BUILD_TOOL="build-tools;${BUILD_TOOLS}"
export ANDROID_SDK_PACKAGES="${EMULATOR_PACKAGE} ${PLATFORM_VERSION} ${BUILD_TOOL} platform-tools"
export ANDROID_SDK_ROOT

export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/tools:$ANDROID_SDK_ROOT/cmdline-tools/tools/bin:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/tools/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/build-tools/${BUILD_TOOLS}:$ANDROID_SDK_ROOT/platform-tools/"
export EMULATOR_DEVICE="pixel_6" # all emulators are created with the pixel 6 spec for now


# this should only be done when we bump the API version or add a worker to the CI that needs emulators to be setup
# Once you've run this, you must also start_for_snapshots() and force_save_snapshots() (see details below)
function create_emulators() {
        # Skip apt install on Mac
    if [[ "$OSTYPE" != "darwin"* ]]; then
        sudo apt update
        sudo apt install -y ca-certificates curl git vim bash wget unzip tree htop gzip default-jre libnss3 libxcursor1 libqt5gui5 libc++-dev libxcb-cursor0 htop tree tar gzip gh nload
    fi

    sudo rm -rf $ANDROID_SDK_ROOT

    sudo mkdir -p $ANDROID_SDK_ROOT
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sudo chown $USER:staff $ANDROID_SDK_ROOT
    else
        sudo chown $USER:$USER $ANDROID_SDK_ROOT
    fi
    # Download the SDK tools
    if [[ "$OSTYPE" == "darwin"* ]]; then
        curl -L -o /tmp/${ANDROID_CMD} https://dl.google.com/android/repository/${ANDROID_CMD}
    else
        wget https://dl.google.com/android/repository/${ANDROID_CMD} -P /tmp
    fi

    # Check if download succeeded
    if [[ ! -f /tmp/${ANDROID_CMD} ]]; then
        echo "Failed to download Android SDK tools"
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
        CONFIG_FILE="$HOME/.android/avd/emulator$i.avd/config.ini"
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # Mac: 9 emulators @ 2GB each
            sed -i '' 's/^hw\.ramSize=.*/hw.ramSize=2048/' "$CONFIG_FILE"
        else
            # Linux: Keep original 4GB
            sed -i 's/^hw\.ramSize=.*/hw.ramSize=4192/' "$CONFIG_FILE"
        fi
    done
}

function start_for_snapshots() {
    for i in $(seq 1 $EMULATOR_COUNT)
    do
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # Mac: Not headless
            $EMULATOR_BIN @emulator$i -no-snapshot-load &
        else
            # Linux: Keep as-is with display
            DISPLAY=:0 $EMULATOR_BIN @emulator$i -gpu host -accel on -no-snapshot-load &
        fi
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
    if [[ "$OSTYPE" == "darwin"* ]]; then
        killall qemu-system-aarch64-headless 2>/dev/null || true
    else
        killall qemu-system-x86_64 2>/dev/null || true
    fi
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