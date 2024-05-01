
[
  // Unit tests (PRs only)
  {
  kind: 'pipeline',
  type: 'docker',
  name: 'Session Android Integration tests',
  platform: { os: 'linux', arch: 'amd64' },
  steps: [
    {
      name: 'appium android tests',
      image: "registry.oxen.rocks/appium-34-pixel6",
      environment: {
         'APK_URL': 'https://oxen.rocks/AL-Session/session-android/dev/session-android-20240402T225341Z-d3c863574-universal.tar.xz',
        'APK_TO_TEST_PATH':'/session.apk',
        'NODE_CONFIG_ENV': 'ci',
        },
      commands: [
        'cp -r docker/etc/* /etc',
        '/usr/bin/supervisord -c /etc/supervisord_test.conf',
        'chmod +x ./docker/*.sh',
        './docker/start_emulators.sh',
        './docker/dl.sh',
        'yarn install --immutable && yarn tsc && yarn test-no-retry ""'

      ],

    },
  ],
},
]

