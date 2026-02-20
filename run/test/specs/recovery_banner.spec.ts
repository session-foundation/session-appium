import { test, type TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { communities } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { androidIt } from '../../types/sessionIt';
import { ConversationItem, PlusButton } from '../locators/home';
import { RecoveryPhraseContainer, RevealRecoveryPhraseButton } from '../locators/settings';
import { joinCommunity } from '../utils/community';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

androidIt({
  title: 'Recovery password banner only shows after >2 conversations',
  risk: 'medium',
  testCb: bannerShowsThreeConvos,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Settings',
    suite: 'Recovery Password',
  },
  allureDescription:
    'Verifies that the recovery password banner only shows after the user has at least three conversations.',
});

androidIt({
  title: 'Recovery password banner disappears after being opened',
  risk: 'medium',
  testCb: bannerDisappearsAfterOpened,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Settings',
    suite: 'Recovery Password',
  },
  allureDescription: 'Verifies that the recovery password banner disappears after first opened.',
});

androidIt({
  title: 'Recovery password banner persists with <3 conversations',
  risk: 'medium',
  testCb: bannerPersists,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Settings',
    suite: 'Recovery Password',
  },
  allureDescription:
    'Verifies that the recovery password banner does not disappear if the conversation count drops below 3',
});

async function bannerShouldNotshow(device: DeviceWrapper) {
  await device.waitForTextElementToBePresent(new PlusButton(device));
  await device.verifyElementNotPresent(new RevealRecoveryPhraseButton(device));
  device.log('On home screen, banner did not appear');
}

async function bannerShouldShow(device: DeviceWrapper) {
  await device.waitForTextElementToBePresent(new PlusButton(device));
  await device.waitForTextElementToBePresent(new RevealRecoveryPhraseButton(device));
  device.log('On home screen, banner appeared');
}

async function bannerShowsThreeConvos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step('Create three conversations, verify banner only appears after the third', async () => {
    for (const community of Object.values(communities).slice(0, 3)) {
      await bannerShouldNotshow(device);
      await joinCommunity(device, community.link, community.name);
      await device.navigateBack();
    }
    await bannerShouldShow(device);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function bannerDisappearsAfterOpened(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step('Create three conversations, verify banner does not reappear after being opened', async () => {
    for (const community of Object.values(communities).slice(0, 3)) {
      await joinCommunity(device, community.link, community.name);
      await device.navigateBack();
    }
    await bannerShouldShow(device);
    await device.clickOnElementAll(new RevealRecoveryPhraseButton(device));
    await device.waitForTextElementToBePresent(new RecoveryPhraseContainer(device));
    await device.navigateBack();
    await bannerShouldNotshow(device);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function bannerPersists(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step('Create three conversations, verify banner persists after a conversation is deleted', async () => {
    for (const community of Object.values(communities).slice(0, 3)) {
      await joinCommunity(device, community.link, community.name);
      await device.navigateBack();
    }
    await bannerShouldShow(device);
    await device.longPressConversation(communities.testCommunity.name);
    await device.clickOnElementAll({ strategy: 'accessibility id', selector: 'Leave' }); // Long press options
    await device.clickOnElementAll({ strategy: 'accessibility id', selector: 'Leave' }); // Modal confirm
    await device.verifyElementNotPresent(
      new ConversationItem(device, communities.testCommunity.name)
    );
    await bannerShouldShow(device);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
