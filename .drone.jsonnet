
[
  // Unit tests (PRs only)
  {
  kind: 'pipeline',
  type: 'exec',
  name: 'Session Android Integration tests',
  platform: { os: 'linux', arch: 'amd64' },
  steps: [
    {
      name: 'appium android tests',
    //   image: "ubuntu",
    //   environment: {
    //     'NVM_DIR': '/usr/local/nvm',
    //     'NODE_VERSION': '18.15.0',
    //     'SESSION_DESKTOP_ROOT': '/root/session-desktop',
    //     'NODE_PATH': '$NVM_DIR/v$NODE_VERSION/lib/node_modules',
    //     'APK_TO_TEST_URL': '',
    //     'APK_TO_TEST_PATH'=~/session.apk,
    //     'CI': '1',
        // },
      commands: [
        'export PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH"',
        'echo $APK_TO_TEST_URL',
        'wget $APK_TO_TEST_PATH $APK_TO_TEST_PATH'
        // 'docker pull us-docker.pkg.dev/android-emulator-268719/images/30-google-x64-no-metrics:30.1.2',
        // 'docker run -e ADBKEY="$(cat ~/.android/adbkey)" --device /dev/kvm --publish 8555:8554/tcp --publish 5555:5555/tcp us-docker.pkg.dev/android-emulator-268719/images/30-google-x64-no-metrics:30.1.2',
        // 'docker run -e ADBKEY="$(cat ~/.android/adbkey)" --device /dev/kvm --publish 8555:8554/tcp --publish 5556:5555/tcp us-docker.pkg.dev/android-emulator-268719/images/30-google-x64-no-metrics:30.1.2'
      ],

    },
  ],
},
]

