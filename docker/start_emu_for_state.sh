#!/bin/bash
set -x

emulator_name="emulator1"

function start_emulator_headless() {
  rm -rf /root/.android/avd/emulator1.avd/snapshots/ # delete any saved snapshots
  nohup emulator -avd "${emulator_name}" -no-boot-anim -gpu off -no-accel -no-window -no-snapshot &  # no -read only flag here
  printf "==> Emulator ${emulator_name} has started in headless mode! \n"
}

function disable_animation() {
  adb  shell "settings put global window_animation_scale 0.0"
  adb  shell "settings put global transition_animation_scale 0.0"
  adb  shell "settings put global animator_duration_scale 0.0"
}

function stop_emulator() {
  printf "==> Stopping emulator for snapshot grab... \n"
  adb -s emulator-5554 emu kill
  printf "==> Emulator stopped \n"
}


function wait_emulator_to_be_ready() {
  start_time=$(date +%s)
  timeout=960 # the avd (without cpu virtualization takes 907s to boot up on my machine)
  sleep_interval=5
  printf "==> Waiting booted emulator 🧐... \n"

  while [ "`adb shell getprop sys.boot_completed | tr -d '\r' `" != "1" ] ; do
    adb devices  # this script is broken for now, as it always reports devices as being offline during the docker build 
    current_time=$(date +%s)
    elapsed_time=$((current_time - start_time))
    if [ $elapsed_time -gt $timeout ]; then
      printf "==> Timeout after ${timeout} seconds elapsed 🕛.. \n"
      break
    fi
    printf "==> Emulator not reported as booted yet 🧐... sleeping ${sleep_interval} before retry\n"
    sleep $sleep_interval;
  done

  if [ "`adb shell getprop sys.boot_completed | tr -d '\r' `" == "1" ] ; then
    printf "==> Emulator is booted! \n"
  fi
}


sleep 5
start_emulator_headless
sleep 5
wait_emulator_to_be_ready # wait for the emulator to report that the boot is complete
sleep 1
disable_animation
sleep 1


adb shell input keyevent 82

# add extra because it is still doing a bunch of things when booted without a saved state, and that'd time saved on restore
sleep 300

stop_emulator
sleep 10 # give some time to save the snapshot

