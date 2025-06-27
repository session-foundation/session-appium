import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { allureResultsDir, allureCurrentReportDir } from '../../../../constants/allure';
import { SupportedPlatformsType } from '../open_app';

export interface ReportContext {
  platform: SupportedPlatformsType;
  build: string;
  artifact: string;
  risk: string;
  runNumber: number;
  runAttempt: number;
  runID: number;
  reportFolder: string;
  reportUrl: string;
  githubRunUrl: string;
}

/**
 * Derives consistent context values from CI env
 */
export function getReportContextFromEnv(): ReportContext {
  const platform = process.env.PLATFORM! as SupportedPlatformsType;
  const build = process.env.BUILD_NUMBER!;
  const artifact = process.env.APK_URL!;
  const risk = process.env.RISK?.trim() || 'full';
  const runNumber = Number(process.env.GITHUB_RUN_NUMBER);
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const runID = Number(process.env.GITHUB_RUN_ID);
  const reportFolder = `run-${runNumber}.${runAttempt}-${platform}-${build}-${risk}`;
  const reportUrl = `https://session-foundation.github.io/session-appium/${platform}/${reportFolder}/`;
  const githubRunUrl = `https://github.com/session-foundation/session-appium/actions/runs/${runID}`;

  return {
    platform,
    build,
    artifact,
    risk,
    runNumber,
    runAttempt,
    runID,
    reportFolder,
    reportUrl,
    githubRunUrl,
  };
}
// The Environment block shows up in the report dashboard
export async function writeEnvironmentProperties(ctx: ReportContext) {
  await fs.ensureDir(allureResultsDir);
  const content = [
    `platform=${ctx.platform}`,
    `build=${ctx.build}`,
    `artifact=${ctx.artifact}`,
    `appium=https://github.com/session-foundation/session-appium/commit/${getGitCommitSha()}`,
    `branch=${getGitBranch()}`,
  ].join('\n');

  await fs.writeFile(path.join(allureResultsDir, 'environment.properties'), content);
  console.log('Created environment.properties');
}
// The Executors block shows up in the report dashboard and links back to the CI run
// It also allows us to access history through trend graphs and test results
export async function writeExecutorJson(ctx: ReportContext) {
  const buildOrder = ctx.runAttempt > 1 ? `${ctx.runNumber}.${ctx.runAttempt}` : `${ctx.runNumber}`;
  const executor = {
    name: 'GitHub Actions',
    type: 'github',
    url: ctx.githubRunUrl,
    buildOrder: buildOrder,
    buildName: `GitHub Actions Run #${ctx.runID}`,
    buildUrl: ctx.githubRunUrl,
    reportUrl: ctx.reportUrl,
  };

  await fs.writeFile(
    path.join(allureResultsDir, 'executor.json'),
    JSON.stringify(executor, null, 2)
  );
  console.log('Created executor.json');
}
// The metadata.json is a custom file for the front-end display
export async function writeMetadataJson(ctx: ReportContext) {
  const metadata = {
    platform: ctx.platform,
    build: ctx.build,
    risk: ctx.risk,
    runNumber: ctx.runNumber,
    runAttempt: ctx.runAttempt,
  };

  await fs.writeFile(
    path.join(allureCurrentReportDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  console.log('Created metadata.json');
}

// Custom css injection for neat diffing and media display
export async function patchStylesCss() {
  const stylesPath = path.join(allureCurrentReportDir, 'styles.css');
  const customCss = `
    /* Custom overrides */
    .attachment__media,
    .screen-diff__image {
    max-height: 90vh;
    }
`;

  try {
    await fs.appendFile(stylesPath, customCss);
    console.log('Patched styles.css with custom CSS');
  } catch (err) {
    console.error(`Failed to patch styles.css: ${(err as Error).message}`);
  }
}

function getGitCommitSha(): string {
  return execSync('git rev-parse HEAD').toString().trim();
}

function getGitBranch(): string {
  return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
}
