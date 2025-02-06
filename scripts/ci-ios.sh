#!/bin/bash

SIMULATOR_DEVICE="iPhone 15 Pro Max"
SIMULATOR_OS="18.2"

# Define an array of uppercase words for simulator names
NUMBER_WORDS=("FIRST" "SECOND" "THIRD" "FOURTH" "FIFTH" "SIXTH" "SEVENTH" "EIGHTH" "NINTH" "TENTH" "ELEVENTH" "TWELFTH")

# Function to create simulators only if they don't exist
function create_simulators() {
    echo "Checking if environment variables are available..."
    printenv | grep IOS_

    echo "Creating iOS simulators from environment variables..."

    for i in {1..12}; do
        simulator_label=${NUMBER_WORDS[$((i - 1))]}  # Convert index to word
        env_var="IOS_${simulator_label}_SIMULATOR"   # Correct variable name
        simulator_udid=$(printenv "$env_var")  # Fetch the value of the env var

        if [[ -n "$simulator_udid" ]]; then
            # Check if the simulator already exists
            if xcrun simctl list devices | grep -q "$simulator_udid"; then
                echo "$simulator_label simulator ($simulator_udid) already exists. Skipping creation."
            else
                echo "Creating $simulator_label simulator..."
                new_udid=$(xcrun simctl create "iPhone-$simulator_label" "$SIMULATOR_DEVICE" "com.apple.CoreSimulator.SimRuntime.iOS-$SIMULATOR_OS")
                export IOS_${simulator_label}_SIMULATOR="$new_udid"  # Store the new UDID
                echo "Created $simulator_label simulator with UDID: $new_udid"
            fi
        else
            echo "Skipping $simulator_label simulator (not set)"
        fi
    done
}

# Function to boot simulators from environment variables
function start_simulators_from_env() {
    echo "Starting iOS simulators from environment variables..."

    for i in {1..12}; do
        simulator_label=${NUMBER_WORDS[$((i - 1))]}
        env_var="IOS_${simulator_label}_SIMULATOR"
        simulator_udid=$(printenv "$env_var")

        if [[ -n "$simulator_udid" ]]; then
            echo "Booting $simulator_label simulator: $simulator_udid"
            xcrun simctl boot "$simulator_udid"
        else
            echo "Skipping $simulator_label simulator (not set)"
        fi
    done

    echo "Opening iOS Simulator app..."
    open -a Simulator
}

# Function to start the Appium server
function start_appium_server() {
    echo "Starting Appium server..."
    cd forked-session-appium || exit
    start-server
}

# Function to stop running simulators
function stop_simulators_from_env() {
    echo "Stopping iOS simulators from environment variables..."

    for i in {1..12}; do
        simulator_label=${NUMBER_WORDS[$((i - 1))]}
        env_var="IOS_${simulator_label}_SIMULATOR"
        simulator_udid=$(printenv "$env_var")

        if [[ -n "$simulator_udid" ]]; then
            # Check if the simulator is running
            if xcrun simctl list devices booted | grep -q "$simulator_udid"; then
                echo "Stopping $simulator_label simulator: $simulator_udid"
                xcrun simctl shutdown "$simulator_udid"
            else
                echo "$simulator_label simulator is not running or does not exist."
            fi
        else
            echo "Skipping $simulator_label simulator (not set)"
        fi
    done
}
