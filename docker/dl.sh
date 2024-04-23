#!/bin/bash

apk_url=${APK_URL}
apk_saved_on=${APK_TO_TEST_PATH}

cd /
wget -O /session.apk.tar.xz $apk_url
tar xvf /session.apk.tar.xz
mv /session*/*.apk /session.apk
cd -
