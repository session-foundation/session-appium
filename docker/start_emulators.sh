#!/bin/bash

set -ex

DIR="$(cd "$(dirname "$0")" && pwd)"

start_emu=$DIR/start_emu.sh

adb devices

function wait_emulator_to_be_ready() {
  to_wait_for="${1}"
  start_time=$(date +%s)
  timeout=200
  sleep_interval=1
  printf "==> Waiting booted emulator ... \n"

  while [ "`adb -s ${to_wait_for} shell getprop sys.boot_completed | tr -d '\r' `" != "1" ] ; do
    adb devices
    current_time=$(date +%s)
    elapsed_time=$((current_time - start_time))
    if [ $elapsed_time -gt $timeout ]; then
      printf "==> Timeout after ${timeout} seconds elapsed .. \n"
      break
    fi
    printf "==> Emulator not reported as booted yet ... sleeping ${sleep_interval} before retry\n"
    sleep $sleep_interval;
  done

  if [ "`adb -s ${to_wait_for} shell getprop sys.boot_completed | tr -d '\r' `" == "1" ] ; then
    printf "==> Emulator is booted! \n"
  fi
}

export EMULATOR_NAME="emulator1" # they all share the same avd, but started with the -read-only flag to make it work
DEVICE_NAME="emulator-5554" $start_emu &
sleep 1
DEVICE_NAME="emulator-5556" $start_emu &
sleep 1
DEVICE_NAME="emulator-5558" $start_emu &
sleep 1
DEVICE_NAME="emulator-5560" $start_emu &
sleep 1

sleep 30;
adb devices;sleep 30;
adb devices;sleep 30;
adb devices;sleep 30;
adb devices;sleep 30;
adb devices;sleep 30;
adb devices;sleep 30;
adb devices;
# wait_emulator_to_be_ready "emulator-5554"
# wait_emulator_to_be_ready "emulator-5556"
# wait_emulator_to_be_ready "emulator-5558"
# wait_emulator_to_be_ready "emulator-5560"

# wait # hang in here while the emulators are running
