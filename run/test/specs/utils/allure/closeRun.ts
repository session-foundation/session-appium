import { exec } from 'child_process';
import fs from 'fs-extra';

import { allureCurrentReportDir, allureResultsDir } from '../../../../constants/allure';
import {
  getReportContextFromEnv,
  writeEnvironmentProperties,
  writeExecutorJson,
} from './allureHelpers';

// Bail out early if not on CI
if (process.env.CI !== '1' || process.env.ALLURE_ENABLED === 'false') {
  console.log('Skipping closeRun (CI != 1 or ALLURE_ENABLED is false)');
  process.exit(0);
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

// Close test run: manipulate custom files, generate report
async function closeRun() {
  // Gather and write metadata files
  const ctx = getReportContextFromEnv();
  await writeEnvironmentProperties(ctx);
  await writeExecutorJson(ctx);

  // Generate report
  await generateAllureReport();

  // Clear allure-results directory for next run
  await fs.emptyDir(allureResultsDir);
  console.log('Allure results cleared.');
}

closeRun().catch(err => {
  console.error('Error during execution:', err);
  process.exit(1);
});
