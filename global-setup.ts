import { FullConfig } from '@playwright/test';

import { getNetworkTarget } from './run/test/utils/devnet';
import { SupportedPlatformsType } from './run/test/utils/open_app';

export default async function globalSetup(_config: FullConfig) {
  const platform = process.env.PLATFORM as SupportedPlatformsType | undefined;

  if (platform) {
    console.log(`Validating build/network configuration...`);
    await getNetworkTarget(platform); // already logs and throws on error, no need to duplicate it in global config
  } else {
    // The CI knows the platform variable, this is for local development
    console.log('No PLATFORM variable set, network validation will happen on a per-test level');
  }
}
