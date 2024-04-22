const config = {
  programs: {
    adbPath: '',
    sdkManagerPath: '',
    emulatorPath: '',
    androidSystemImage: '',
  },
  emulators: {
    ios: { first: '', second: '', third: '', fourth: '' },
    android: {
      first: '',
      second: '',
      third: '',
      fourth: '',
    }, // those are emulator udid
  },
  testedApps: {
    ios: '',
    android: '',
  },
};

export default config;

export type ConfigType = typeof config;
