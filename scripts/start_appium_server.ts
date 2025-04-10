import { spawn } from 'child_process';
import { existsSync, unlinkSync, openSync, readFileSync } from 'node:fs';
import { killProcessByPort, sleepSync } from './shared';

const logFile = 'appium_server.log';

const APPIUM_SERVER_PORT = 8110;

function waitForAppiumReadySync(timeout = 20000): void {
  const start = Date.now();
  const endTime = start + timeout;

  while (Date.now() < endTime) {
    const contents = readFileSync(logFile, 'utf-8');
    if (contents.includes('Appium REST http interface listener started')) {
      return; // Success
    }

    sleepSync(1); // Wait a bit before checking again
  }

  throw new Error('Timed out waiting for Appium to start');
}

function startAppiumServer() {
  killProcessByPort(APPIUM_SERVER_PORT);
  console.log('Starting Appium server...');

  // Clear previous log
  if (existsSync(logFile)) unlinkSync(logFile);

  spawn(
    './node_modules/.bin/appium',
    [
      'server',
      '--use-drivers=uiautomator2,xcuitest',
      `--port=${APPIUM_SERVER_PORT}`,
      '--allow-cors',
    ],
    {
      stdio: ['ignore', openSync(logFile, 'a'), openSync(logFile, 'a')],
      detached: true,
    }
  );

  sleepSync(1);

  try {
    waitForAppiumReadySync();
    console.log('✅ Appium server is ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to start Appium server:', err);
    process.exit(1);
  }
}

startAppiumServer();
