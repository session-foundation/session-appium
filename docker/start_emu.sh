#!/bin/bash
set -ex

BL='\033[0;34m'
G='\033[0;32m'
RED='\033[0;31m'
YE='\033[1;33m'
NC='\033[0m' # No Color

emulator_name=${EMULATOR_NAME}
device_name=${DEVICE_NAME}

function start_emulator() {
  emulator -avd "${emulator_name}" -gpu off -read-only
  printf "${G}==>  ${BL}Emulator has ${YE}${EMULATOR_NAME} ${BL}started in headed mode! ${G}<==${NC}""\n"
}

function disable_animation() {
  adb -s ${device_name} shell "settings put global window_animation_scale 0.0"
  adb -s ${device_name} shell "settings put global transition_animation_scale 0.0"
  adb -s ${device_name} shell "settings put global animator_duration_scale 0.0"
}

start_emulator
sleep 1
disable_animation