import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import {
  allureCurrentReportDir,
  resultsHistoryDir,
  reportHistoryDir,
  allureResultsDir,
  backupHistoryDir,
} from '../../../../constants/allure';
import { SupportedPlatformsType } from '../open_app';

// Create environment.properties file with platform and build info
async function createEnvProperties(platform: SupportedPlatformsType, build: string) {
  const envPropertiesFile = path.join(allureResultsDir, 'environment.properties');
  const content = `platform=${platform}\nbuild=${build}`;
  await fs.writeFile(envPropertiesFile, content);
  console.log(`Created environment.properties:\n${content}`);
}

// Generate Allure report from the results directory
async function generateAllureReport() {
  return new Promise<void>((resolve, reject) => {
    exec(`allure generate ${allureResultsDir} -o ${allureCurrentReportDir} --clean`, error => {
      if (error) {
        return reject(new Error(`Allure report generation failed: ${error.message}`));
      }
      console.log('Allure report generated successfully.');
      resolve();
    });
  });
}

// Close test run: handle histories, generate report, and clean up
async function closeRun() {
  // Read platform & build from env
  const platform = process.env.PLATFORM as SupportedPlatformsType;
  const build = process.env.BUILD!;

  await createEnvProperties(platform, build);

  // Merge archived history if exists
  if (await fs.pathExists(backupHistoryDir)) {
    await fs.ensureDir(resultsHistoryDir);
    await fs.copy(backupHistoryDir, resultsHistoryDir, { overwrite: true });
    console.log('Archived history merged successfully.');
  } else {
    console.log('No archived history found.');
  }

  await generateAllureReport();

  // Archive the current run's history
  if (await fs.pathExists(reportHistoryDir)) {
    await fs.copy(reportHistoryDir, backupHistoryDir, { overwrite: true });
    console.log('Current history archived successfully.');
  } else {
    console.log('No report history to archive.');
  }

  // Clear allure-results directory for next run
  await fs.emptyDir(allureResultsDir);
  console.log('Allure results cleared.');
}


closeRun().catch(err => {
  console.error('Error during execution:', err);
});
