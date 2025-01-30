#!/bin/bash

SIMULATOR_NAME="iPhone 15 Pro Max $i"
SIMULATOR_DEVICE="iPhone 15 Pro Max"
SIMULATOR_OS="18.2"


# This script is used to run the CI on iOS
function create_simulators() {
    echo "Creating iOS simulators from environment variables..."

    for i in {1..12}; do
        env_var="IOS_${i}_SIMULATOR"
        simulator_udid=${!env_var}  # Fetch the value of the env var

        if [[ -n "$simulator_udid" ]]; then
            # Check if the simulator already exists
            if xcrun simctl list devices | grep -q "$simulator_udid"; then
                echo "Simulator $simulator_udid already exists. Skipping creation."
            else
                echo "Creating simulator: $simulator_udid"
                xcrun simctl create "iPhone-Sim-$i" "iPhone 15 Pro Max" "com.apple.CoreSimulator.SimRuntime.iOS-17-2"
            fi
        else
            echo "Skipping IOS_${i}_SIMULATOR (not set)"
        fi
    done
}

function start_simulators_from_env() {
    echo "Starting iOS simulators from environment variables..."

    for i in {1..12}; do
        env_var="IOS_${i}_SIMULATOR"
        simulator_udid=${!env_var}  # Fetch the value of the env var

        if [[ -n "$simulator_udid" ]]; then
            echo "Booting simulator: $simulator_udid"
            xcrun simctl boot "$simulator_udid"
        else
            echo "Skipping IOS_${i}_SIMULATOR (not set)"
        fi
    done

    echo "Opening iOS Simulator app..."
    open -a Simulator
}


function start_appium_server() {
        echo "Starting Appium server..."
        cd forked-session-appium
        start-server
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