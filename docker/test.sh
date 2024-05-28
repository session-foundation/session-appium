#!/bin/bash
set -ex

cd /session-appium && yarn install --immutable && yarn tsc && yarn test-no-retry ""