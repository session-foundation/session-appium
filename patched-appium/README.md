This is convoluted, but it seems that

- we need yarn 4.0.2 to make some crappy appium modules
- we need to patch some appium packages (see the integration-tests/patches folder)
- to patch packages with yarn 4, we need to have a reference of the original versions somewhere locally.

This patched-appium folder is here for that. It only exists so that the integration-tests package.json can reference the packages in this node_modules so they can be patched.
At some point, appium might fix this, but so far they did not.

So in the meantime, to get a new setup of appium tests for Session working you need to (and do all those steps)

```
cd patched-appium
rm -rf .yarnrc.yml .yarn node_modules
yarn set version 1.22.19 && yarn set version 4.0.2
yarn config set nodeLinker node-modules
yarn install --frozen-lockfile # you might need to remove the --frozen-lockfile if you get an error about "lockfile should have been updated:
ls node_modules/{appium-uiautomator2-driver,appium-xcuitest-driver,@appium/execute-driver-plugin} # this should print content

cd ../integration-tests
rm -rf .yarnrc.yml .yarn node_modules
yarn set version 1.22.19 && yarn set version 4.0.2
yarn config set nodeLinker node-modules
yarn install --frozen-lockfile # you might need to remove the --frozen-lockfile if you get an error about "lockfile should have been updated:

```
