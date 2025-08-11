import { FullConfig } from '@playwright/test';

import { getNetworkTarget } from './run/test/specs/utils/devnet';
import { SupportedPlatformsType } from './run/test/specs/utils/open_app';

export default function globalSetup(_config: FullConfig) {
  const platform = process.env.PLATFORM as SupportedPlatformsType | undefined;

  if (platform) {
    console.log(`Validating build/network configuration...`);
    getNetworkTarget(platform); // already logs and throws on error, no need to duplicate it in global config
  } else {
    // The CI knows the platform variable, this is for local development
    console.log('No PLATFORM variable set, network validation will happen on a per-test level');
  }
}
