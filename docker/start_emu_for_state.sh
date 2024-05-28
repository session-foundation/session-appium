#!/bin/bash
set -x

emulator_name="emulator1"

function start_emulator_for_state() {
  rm -rf /root/.android/avd/emulator1.avd/snapshots/ # delete any saved snapshots
  nohup emulator -avd "${emulator_name}" -gpu off -no-snapshot-load &  # no -read only flag here
  printf "==> Emulator ${emulator_name} has started IN HEADED mode! \n"
}

start_emulator_for_state
