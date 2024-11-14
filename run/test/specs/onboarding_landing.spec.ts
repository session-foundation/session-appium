import { bothPlatformsIt } from '../../types/sessionIt';
import { newUser } from './utils/create_account';
import { openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { USERNAME } from '../../types/testing';
import { saveAndCompare } from './utils/compare_images';

bothPlatformsIt('Onboarding landing page', 'high', onboardingLanding)

async function onboardingLanding(platform: SupportedPlatformsType) {
    const { device } = await openAppOnPlatformSingleDevice(platform);
    await newUser(device, USERNAME.ALICE, platform);
    await saveAndCompare(
        device,
        {strategy: 'id',
        selector: 'network.loki.messenger:id/emptyStateContainer'}, 
        'run/test/specs/media/onboarding_landing.png');
}