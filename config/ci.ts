export default {
  programs: {
    adbPath: "/opt/android/platform-tools/adb",
    sdkManagerPath: "/opt/android/cmdline-tools/tools/bin/sdkmanager",
    emulatorPath: "/opt/android/emulator/emulator",
    androidSystemImage: "", // unused for CI, we create the emulators before we run the tests as part of the DockerFile
  },
  emulators: {
    ios: { first: "1", second: "2", third: "3", fourth: "4" }, // those are emulator udid
    android: {
      first: "emulator-5554",
      second: "emulator-5556",
      third: "emulator-5558",
      fourth: "emulator-5560",
    },
  },
  testedApps: {
    ios: "dontcare",
    android: "/session.apk", // equivalent of APK_TO_TEST_PATH
  },
};
