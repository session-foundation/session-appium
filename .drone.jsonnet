
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
      image: "android-emulator",
      environment: {
        'APK_TO_TEST_URL': '',
        'APK_TO_TEST_PATH':'/session.apk',
        'NODE_CONFIG_ENV': 'ci',
        },
      commands: [
        '/usr/bin/supervisord -c /etc/supervisord_test.conf',
        '/usr/bin/dl_and_test'

      ],

    },
  ],
},
]

