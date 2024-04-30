#!/bin/bash
set -ex

emulator_name="emulator1"
device_name="emulator-5554"

function wait_emulator_to_be_ready() {
  rm -rf /root/.android/avd/emulator1.avd/snapshots/ # delete any saved snapshots
  emulator -avd "${emulator_name}" -no-boot-anim -gpu off # no -read only flag here
  printf "==> Emulator has ${EMULATOR_NAME} started in headed mode! \n"
}

function disable_animation() {
  adb -s ${device_name} shell "settings put global window_animation_scale 0.0"
  adb -s ${device_name} shell "settings put global transition_animation_scale 0.0"
  adb -s ${device_name} shell "settings put global animator_duration_scale 0.0"
}

wait_emulator_to_be_ready
sleep 1
disable_animation
sleep 1
# wait for the emulator 