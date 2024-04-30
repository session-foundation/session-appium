#!/bin/bash

cd /session-appium && yarn install --immutable && yarn tsc && yarn test-no-retry ""