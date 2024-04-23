#!/bin/bash

set -ex

DIR="$(cd "$(dirname "$0")" && pwd)"

# start_headless=$DIR/start_emu_headless.sh
start_headless=$DIR/start_emu.sh

adb devices

export EMULATOR_NAME="emulator1"
export DEVICE_NAME="emulator-5554"
EMULATOR_NAME="emulator1" DEVICE_NAME="emulator-5554" $start_headless &

export EMULATOR_NAME="emulator2"
export DEVICE_NAME="emulator-5556"
$start_headless &

export EMULATOR_NAME="emulator3"
export DEVICE_NAME="emulator-5558"
$start_headless &

export EMULATOR_NAME="emulator4"
export DEVICE_NAME="emulator-5560"
$start_headless &


wait