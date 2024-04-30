#!/bin/bash

set -ex

DIR="$(cd "$(dirname "$0")" && pwd)"

start_emu=$DIR/start_emu.sh

adb devices

export EMULATOR_NAME="emulator1" # they all share the same avd, but started with the -read-only flag to make it work
DEVICE_NAME="emulator-5554" nice ionice $start_emu &
DEVICE_NAME="emulator-5556" nice ionice $start_emu &
DEVICE_NAME="emulator-5558" nice ionice $start_emu &
DEVICE_NAME="emulator-5560" nice ionice $start_emu &

wait # wait for the 4 emulators above to be started
