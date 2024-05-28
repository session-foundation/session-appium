### Build the base image without the adb in it

**This has to be done once on each computers you use this docker, and if you ever change the Dockerfile.base settings related to the avd.**

Comment this line in the Dockerfile:
`COPY avd /root/.android/avd`

then run build both docker images (base and test one) so you can manually build a snapshot for your avds. (step 1)
```sh
clear; sudo docker build -t android-emulator-base -f Dockerfile.base .  && sudo docker build -t android-emulator -f Dockerfile . && sudo docker run --privileged  -it --device /dev/kvm -p 8080:8080  android-emulator
```

Once that's done, open a browser to http://localhost:8080/vnc.html, you should see the novnc connect button.
Connect, and in the terminal opened, enter this (copy/paste doesn't work for now)
```
./docker/start_emu_for_state.sh
```

Let the emulator start, and give it a few more minutes so the snapshot is as complete as possible.
Then, close manually the emulator, it should display the "saving state" dialog.
Once the state is saved, do on a host terminal from the root of the `appium` folder:
```
sudo rm -rf avd; sudo docker cp $(sudo docker ps -q):/root/.android/avd/ ./avd  # sudo docker ps -q returns the running container hash directly
```


Once that's done, stop the current docker container (ctrl-c should be enough).

Then, uncomment the line
```
COPY avd /root/.android/avd
```

in the Dockerfile, and rebuild the 2 images
```
clear; sudo docker build -t android-emulator-base -f Dockerfile.base .  && sudo docker build -t android-emulator -f Dockerfile . # (step 1)
```
Once that's done, you can start the docker with the apk to test with

```
sudo docker run --privileged  -it --device /dev/kvm  -e APK_URL='<url of apk to test>' -e NODE_CONFIG_ENV="ci"  -e APK_TO_TEST_PATH="/session.apk" -p 8080:8080  android-emulator # (step 2)
```

Then, reconnect via vnc http://localhost:8080/vnc.html, and run in the terminal
```
./docker/start_4_emus.sh &
```
The 4 emulators should start hopefully not too slowly.

You can then trigger the dl of the APK (from the APK_TO_TEST_PATH env variable above) and the integration tests by running the command
`dl_and_test`


### Daily use

No need to rebuild the avds every time you use the docker image/start integration tests, but you will have to rebuild both docker images after a `git pull` the session-appium repository (i.e. updating the integration tests themselves). That step should be very fast though, as everything should be cached by docker. I usually just have one big command to rebuild the changes and restart the container.