import * as allure from 'allure-js-commons';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import { glob } from 'glob';
import path from 'path';

import {
  allureCurrentReportDir,
  allureResultsDir,
  GH_PAGES_BASE_URL,
} from '../../../../constants/allure';
import { AllureSuiteConfig } from '../../../../types/allure';
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
  const platform = process.env.PLATFORM as SupportedPlatformsType | undefined;
  const build = process.env.BUILD_NUMBER;
  const artifact = process.env.APK_URL;
  const risk = process.env.RISK?.trim() || 'full';
  const runNumber = Number(process.env.GITHUB_RUN_NUMBER);
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const runID = Number(process.env.GITHUB_RUN_ID);
  const reportFolder = `run-${runNumber}.${runAttempt}-${platform}-${build}-${risk}`;
  const reportUrl = `${GH_PAGES_BASE_URL}/${platform}/${reportFolder}/`;
  const githubRunUrl = `https://github.com/session-foundation/session-appium/actions/runs/${runID}`;

  if (!platform) {
    throw new Error('PLATFORM env variable is required');
  }
  if (!build) {
    throw new Error('BUILD_NUMBER env variable is required');
  }
  if (!artifact) {
    throw new Error('APK_URL env variable is required');
  }
  if (!runNumber) {
    throw new Error('GITHUB_RUN_NUMBER env variable is required');
  }
  if (!runAttempt) {
    throw new Error('GITHUB_RUN_ATTEMPT env variable is required');
  }
  if (!runID) {
    throw new Error('GITHUB_RUN_ID env variable is required');
  }

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

/**
 * Patches Allure files to use GitHub's LFS CDN URLs instead of relative paths.
 * GitHub Pages serves LFS pointer files, not actual content, so we rewrite
 * attachment URLs to use media.githubusercontent.com which serves the real files.
 */
export async function patchFilesForLFSCDN(ctx: ReportContext) {
  console.log('Patching attachment URLs for LFS CDN...');

  const cdnBase = `https://media.githubusercontent.com/media/session-foundation/session-appium/gh-pages/${ctx.platform}/${ctx.reportFolder}`;

  // Get all files that need patching
  const filesToPatch = [
    path.join(allureCurrentReportDir, 'app.js'),
    ...(await glob(`${allureCurrentReportDir}/plugin/*/index.js`)),
  ];

  // Patch them all
  for (const file of filesToPatch) {
    if (await fs.pathExists(file)) {
      let content = await fs.readFile(file, 'utf-8');
      content = content
        .replace(/"data\/attachments\//g, `"${cdnBase}/data/attachments/`)
        .replace(/'data\/attachments\//g, `'${cdnBase}/data/attachments/`);
      await fs.writeFile(file, content);
    }
  }

  console.log(`Patched ${filesToPatch.length} files for LFS CDN`);
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
// Handle test-level metadata such as suites, test description or linked issues
export async function setupAllureTestInfo({
  suites,
  description,
  links,
  platform,
}: {
  suites?: AllureSuiteConfig;
  description?: string;
  links?: {
    all?: string[] | string; // Bugs affecting both platforms
    android?: string[] | string; // Android only - won't appear in iOS reports
    ios?: string[] | string; // iOS only - won't appear in Android reports
  };
  platform?: 'android' | 'ios';
}) {
  // Handle suites
  if (suites) {
    await allure.parentSuite(suites.parent);
    if ('suite' in suites) {
      await allure.suite(suites.suite);
    }
  }

  // Handle description
  if (description) {
    await allure.description(description);
  }

  // Handle links (only process if platform is provided)
  if (links && platform) {
    const allLinks = links.all ? (Array.isArray(links.all) ? links.all : [links.all]) : [];

    const platformLinks = links[platform]
      ? Array.isArray(links[platform])
        ? links[platform]
        : [links[platform]]
      : [];

    const combinedLinks = [...allLinks, ...platformLinks];

    for (const jiraKey of combinedLinks) {
      await allure.link(`https://optf.atlassian.net/browse/${jiraKey}`, jiraKey, 'issue');
    }
  }
}
