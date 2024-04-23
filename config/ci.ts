export default {
  programs: {
    adbPath: "/home/audric/Android/Sdk/platform-tools/adb",
    sdkManagerPath: "/home/audric/Android/Sdk/tools/bin/sdkmanager",
    emulatorPath: "/home/audric/Android/Sdk/emulator/emulator",
    androidSystemImage: "system-images;android-34;google_atd;x86_64",
  },
  emulators: {
    ios: { first: "1", second: "2", third: "3", fourth: "4" }, // those are emulator udid
    android: {
      first: "emulator1",
      second: "emulator2",
      third: "emulator3",
      fourth: "emulator4",
    },
  },
  testedApps: {
    ios: "dontcare",
    android: process.env.APK_TO_TEST_PATH,
  },
};
