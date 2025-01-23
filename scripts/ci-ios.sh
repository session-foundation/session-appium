#!/bin/bash

SIMULATOR_NAME="iPhone 15 Pro Max $i"
SIMULATOR_DEVICE="iPhone 15 Pro Max"
SIMULATOR_OS="18.2"


# This script is used to run the CI on iOS
function create_simulator() {
    for i in {1..12}
    do    
        if ! xcrun simctl list devices | grep "$SIMULATOR_NAME"; then
            echo "Creating simulator..."
            xcrun simctl create "$SIMULATOR_NAME" "$SIMULATOR_DEVICE" "com.apple.CoreSimulator.SimRuntime.iOS-${SIMULATOR_OS//./-}"
        else
            echo "Simulator $SIMULATOR_NAME already exists."
        fi
    done
}

function start_simulator() {
    for i in {1..12}
    do
        echo "Checking if simulator is already running..."
        if xcrun simctl list devices | grep "$SIMULATOR_NAME" | grep -q "Booted"; then
            echo "Simulator $SIMULATOR_NAME is already running."
            continue
        fi
        echo "Starting simulator...$SIMULATOR_NAME"
        xcrun simctl boot "$SIMULATOR_NAME"
        open -a Simulator
        sleep 20
    done
}

function start_appium_server() {
        echo "Starting Appium server..."
        ./node_modules/.bin/appium server --use-drivers=uiautomator2,xcuitest --port 8110 --allow-cors
}

function stop_simulator() {
    for i in {1..12}
    do
        SIMULATOR_NAME="iPhone 15 Pro Max $i"
        SIMULATOR_UDID=$(xcrun simctl list devices | grep "$SIMULATOR_NAME" | awk '{print $NF}' | tr -d '()')
        if [ -n "$SIMULATOR_UDID" ]; then
            echo "Stopping simulator...$SIMULATOR_NAME ($SIMULATOR_UDID)"
            xcrun simctl shutdown "$SIMULATOR_UDID"
        else
            echo "Simulator $SIMULATOR_NAME not found or already stopped."
        fi
    done
}