#!/usr/bin/env bash

set -euo pipefail

# GitHub repo and target clone dir
GH_REPO="https://x-access-token:${GH_TOKEN}@github.com/session-foundation/session-appium.git"
CLONE_DIR="gh-pages-temp"
REPORTS_DIR="${CLONE_DIR}/reports"

# Clean slate
rm -rf "$CLONE_DIR"

echo "Cloning gh-pages branch"
git clone --depth 1 --branch gh-pages "$GH_REPO" "$CLONE_DIR"

# Locate the latest history folder for the platform
echo "Searching for latest report for $PLATFORM"
LATEST_HISTORY=$(find "$REPORTS_DIR" -type d -name "allure-report-*-${PLATFORM}-*" | sort | tail -n1)

if [[ -z "$LATEST_HISTORY" ]]; then
  echo "No previous report found for '$PLATFORM'. Skipping history injection."
  rm -rf "$CLONE_DIR"
  exit 0
fi

echo "Injecting history from: $LATEST_HISTORY"
mkdir -p allure/allure-results/history
cp -r "$LATEST_HISTORY/history/"* allure/allure-results/history/ || true

echo "Cleaning up temp clone..."
rm -rf "$CLONE_DIR"

echo "Allure history injection complete for $PLATFORM"
