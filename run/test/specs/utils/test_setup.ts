/* 
Checkout branch that needs testing:
The Command needs to include:
- platform
- branch
- number of emulators ( new user to old user ratio )


navigate to platform folder 
  Documents > session-(platform)
git checkout *branch*
then build from branch (ios does automatically, android requires manually click on hammer icon)

ANDROID
start two emulators (cold boot on android)
cd ~/Library/Android/sdk
./emulator/emulator -avd Pixel_4_API_30

open new terminal window
cd ~/Library/Android/sdk
./emulator/emulator -avd Pixel_4_API_30_2

IOS
open -a simulator --args -IOS_1_SIMULATOR -no-boot-anim
open -a simulator --args -IOS_2_SIMULATOR -no-boot-anim

run branch on emulator one
run branch on emulator two

once session is running on emulator one:
click create session id
save session id
click continue
enter display name
continue
continue
continue
save recovery phrase from reminder 
navigate out of reminder page

once session is running on emulator two:
log into test account 
click on restore account







*/
