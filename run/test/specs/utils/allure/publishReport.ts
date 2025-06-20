import fs from 'fs-extra';
import path from 'path';
import { getRunFinishTime } from './getRunFinishTime';
import { allureCurrentReportDir } from '../../../../constants/allure';
import ghpages from 'gh-pages';

// Bail out early if not on CI
if (process.env.CI !== '1' || process.env.ALLURE_ENABLED === 'false') {
  console.log('Skipping closeRun (CI != 1 or ALLURE_ENABLED is false)');
  process.exit(0);
}

function publishToGhPages(dir: string, dest: string, repo: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    void ghpages.publish(
      dir,
      {
        branch: 'gh-pages',
        dest,
        repo,
        message,
        dotfiles: true,
        user: {
          name: 'github-actions',
          email: 'github-actions@users.noreply.github.com',
        },
      },
      err => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        } else {
          resolve();
        }
      }
    );
  });
}
async function publishReport() {
  const environmentFile = path.join(allureCurrentReportDir, 'widgets', 'environment.json');

  if (!(await fs.pathExists(environmentFile))) {
    console.error(`Environment file not found at ${environmentFile}`);
    process.exit(1);
  }

  const jsonContent = await fs.readFile(environmentFile, 'utf8');
  let envData;
  try {
    envData = JSON.parse(jsonContent);
  } catch (err) {
    console.error('Error parsing environment.json:', err);
    process.exit(1);
  }

  let platform = 'unknown';
  let build = 'unknown';
  if (Array.isArray(envData)) {
    for (const item of envData) {
      if (item.name === 'platform' && Array.isArray(item.values) && item.values.length > 0) {
        platform = item.values[0];
      }
      if (item.name === 'build' && Array.isArray(item.values) && item.values.length > 0) {
        build = item.values[0];
      }
    }
  }

  console.log(`Extracted platform: ${platform}, build: ${build}`);

  const baseReportDir = allureCurrentReportDir;
  let runFinishDate: string;
  try {
    runFinishDate = await getRunFinishTime();
  } catch (err) {
    console.error('Error getting run finish time:', err);
    process.exit(1);
  }
  const publishedReportName = `${runFinishDate}-${platform}-${build}-regression-report`;
  const newReportDir = path.join(platform, publishedReportName);

  try {
    await fs.ensureDir(platform);
    await fs.copy(baseReportDir, newReportDir, { overwrite: true });
    console.log(`Report copied to ${newReportDir}`);
  } catch (err) {
    console.error('Error copying report folder:', err);
    process.exit(1);
  }

  const githubToken = process.env.GH_TOKEN;
  if (!githubToken) {
    console.error('GH_TOKEN environment variable is not set.');
    process.exit(1);
  }
  const repoWithToken = `https://x-access-token:${githubToken}@github.com/session-foundation/session-appium.git`;

  console.log(`Deploying report to GitHub Pages as: ${publishedReportName}`);

  try {
    await publishToGhPages(
      newReportDir,
      `${platform}/${publishedReportName}`,
      repoWithToken,
      `ci: publish Allure report for ${platform} ${build}`
    );
    console.log(`Report deployed successfully as: ${publishedReportName}`);
  } catch (err) {
    console.error('Error deploying report to GitHub Pages:', err);
    process.exit(1);
  }

  const reportUrl = `https://session-foundation.github.io/session-appium/${platform}/${publishedReportName}/`;

  const githubOutputPath = process.env.GITHUB_OUTPUT;
  if (githubOutputPath) {
    fs.appendFileSync(githubOutputPath, `report_url=${reportUrl}\n`);
    console.log('Wrote report URL to GITHUB_OUTPUT');
  } else {
    console.log(`REPORT_URL=${reportUrl}`);
  }
}

publishReport().catch(err => {
  console.error('Error in publishReport script:', err);
  process.exit(1);
});
