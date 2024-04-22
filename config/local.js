"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    programs: {
        adbPath: '/home/audric/Android/Sdk/platform-tools/adb',
        sdkManagerPath: '/home/audric/Android/Sdk/tools/bin/sdkmanager',
        emulatorPath: '/home/audric/Android/Sdk/emulator/emulator',
        androidSystemImage: 'system-images;android-34;google_atd;x86_64',
    },
    emulators: {
        ios: { first: '1', second: '2', third: '3', fourth: '4' },
        android: {
            first: 'emulator-5554',
            second: 'emulator-5556',
            third: 'emulator-5558',
            fourth: 'emulator-5560',
        },
    },
    testedApps: {
        ios: 'dontcare',
        android: '/home/audric/Downloads/session-1.18.2-universal.apk',
    },
};
//# sourceMappingURL=local.js.map