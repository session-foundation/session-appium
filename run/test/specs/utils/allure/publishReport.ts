import fs from 'fs-extra';
import path from 'path';
import { allureCurrentReportDir } from '../../../../constants/allure';
import ghpages from 'gh-pages';
import { getReportContextFromEnv, patchStylesCss, writeMetadataJson } from './allureHelpers';

// Bail out early if not on CI
if (process.env.CI !== '1' || process.env.ALLURE_ENABLED === 'false') {
  console.log('Skipping closeRun (CI != 1 or ALLURE_ENABLED is false)');
  process.exit(0);
}

// Publishes the report directory to the gh-pages branch of the repo
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
  const ctx = getReportContextFromEnv();
  await writeMetadataJson(ctx);
  // // Define and create metadata.json for the front-end to fetch data from
  // const platform = process.env.PLATFORM as SupportedPlatformsType;
  // const build = process.env.BUILD_NUMBER!;
  // const runNumber = Number(process.env.GITHUB_RUN_NUMBER);
  // const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  // const risk = process.env.RISK?.trim() || 'full';

  // const metadata = {
  //   platform,
  //   build,
  //   risk,
  //   runNumber,
  //   runAttempt,
  // };

  // fs.writeFileSync(
  //   path.join(allureCurrentReportDir, 'metadata.json'),
  //   JSON.stringify(metadata, null, 2)
  // );

  // Compose the published report directory name
  const publishedReportName = ctx.reportFolder;
  const newReportDir = path.join(ctx.platform, publishedReportName);

  await patchStylesCss();

  // Copy the current report to newReportDir for publishing
  // By doing so, the gh-pages branch hosts /android and /ios subpages with the respective reports
  try {
    await fs.ensureDir(ctx.platform);
    await fs.copy(allureCurrentReportDir, newReportDir, { overwrite: true });
    console.log(`Report copied to ${newReportDir}`);
  } catch (err) {
    console.error('Error copying report folder:', err);
    process.exit(1);
  }

  // Prepare GitHub token and repo URL for gh-pages deployment
  const githubToken = process.env.GH_TOKEN;
  if (!githubToken) {
    console.error('GH_TOKEN environment variable is not set.');
    process.exit(1);
  }
  const repoWithToken = `https://x-access-token:${githubToken}@github.com/session-foundation/session-appium.git`;

  console.log(`Deploying report to GitHub Pages as: ${publishedReportName}`);

  // Publish the report to GitHub Pages
  try {
    await publishToGhPages(
      newReportDir,
      `${ctx.platform}/${publishedReportName}`,
      repoWithToken,
      `ci: publish Allure report for ${ctx.platform} ${ctx.build}`
    );
    console.log(`Report deployed successfully as: ${publishedReportName}`);
  } catch (err) {
    console.error('Error deploying report to GitHub Pages:', err);
    process.exit(1);
  }

  // Write the report URL to GitHub Actions output for downstream steps
  const githubOutputPath = process.env.GITHUB_OUTPUT;
  if (githubOutputPath) {
    fs.appendFileSync(githubOutputPath, `report_url=${ctx.reportUrl}\n`);
    console.log('Wrote report URL to GITHUB_OUTPUT');
  } else {
    console.log(`REPORT_URL=${ctx.reportUrl}`);
  }
}

publishReport().catch(err => {
  console.error('Error in publishReport script:', err);
  process.exit(1);
});
