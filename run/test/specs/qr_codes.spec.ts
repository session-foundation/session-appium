import { test, type TestInfo } from '@playwright/test';

import { communities } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { InteractionPoints, USERNAME } from '../../types/testing';
import { GrantCameraAccessButton, ImagePermissionsModalAllow, ScanQRTab } from '../locators';
import { ConversationHeaderName, ConversationSettings } from '../locators/conversation';
import { AccountIDDisplay, ContinueButton } from '../locators/global';
import { PlusButton } from '../locators/home';
import { AccountRestoreButton, FastModeRadio } from '../locators/onboarding';
import { RecoveryPasswordMenuItem, UserSettings, ViewQR } from '../locators/settings';
import { JoinCommunityOption, NewMessageOption } from '../locators/start_conversation';
import { open_Alice1_bob1_notfriends } from '../state_builder';
import { clickOnCoordinates, sleepFor, verify } from '../utils';
import { joinCommunity } from '../utils/community';
import { newUser } from '../utils/create_account';
import { truncatePubkey } from '../utils/get_account_id';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from '../utils/open_app';
import { handleNotificationPermissions } from '../utils/permissions';

androidIt({
  title: 'Restore account from QR code',
  risk: 'high',
  testCb: qrCodeSeedPhrase,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Onboarding',
    suite: 'Restore account',
  },
  allureDescription:
    'Verifies that an account can be restored on a second device by scanning a recovery phrase QR code',
});

androidIt({
  title: 'New Conversation from QR code',
  risk: 'high',
  testCb: qrCodeAccountID,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'New Message',
  },
  allureDescription: `Verifies that a new conversation can be started by scanning another user's Account ID QR code`,
});

androidIt({
  title: 'Join Community from QR code',
  risk: 'medium',
  testCb: qrCodeCommunity,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'Join Community',
  },
  allureDescription: 'Verifies that a community can be joined by scanning a community QR code',
});

async function qrCodeSeedPhrase(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
  const firstAccountID = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    await newUser(device1, USERNAME.ALICE, { saveUserData: false });
    await device1.clickOnElementAll(new UserSettings(device1));
    const firstAccountIDElement = await device1.waitForTextElementToBePresent(
      new AccountIDDisplay(device1)
    );
    return device1.getTextFromElement(firstAccountIDElement);
  });
  const base64 = await test.step(TestSteps.OPEN.GENERIC('Recovery Password QR code'), async () => {
    await device1.clickOnElementAll(new RecoveryPasswordMenuItem(device1));
    await device1.clickOnElementAll(new ViewQR(device1));
    await sleepFor(500);
    return device1.getScreenshot();
  });
  await test.step(TestSteps.SETUP.RESTORE_ACCOUNT(USERNAME.ALICE), async () => {
    await device2.injectImageToScene(base64);
    await device2.clickOnElementAll(new AccountRestoreButton(device2));
    await device2.clickOnElementAll(new ScanQRTab(device2));
    await device2.clickOnElementAll(new GrantCameraAccessButton(device2));
    await device2.clickOnElementAll(new ImagePermissionsModalAllow(device2));
    await device2.clickOnElementAll(new FastModeRadio(device2));
    await device2.clickOnElementAll(new ContinueButton(device2));
    await handleNotificationPermissions(device2, true);
  });
  await test.step('Verify the correct account has been restored', async () => {
    await device2.clickOnElementAll(new UserSettings(device2));
    const secondAccountIDElement = await device2.waitForTextElementToBePresent(
      new AccountIDDisplay(device2)
    );
    const secondAccountID = await device2.getTextFromElement(secondAccountIDElement);
    verify(firstAccountID, 'The account recovered from QR code is not the right one').toBe(
      secondAccountID
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device1, device2);
  });
}

async function qrCodeAccountID(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_bob1_notfriends({ platform, testInfo });
  });
  const base64 = await test.step(TestSteps.OPEN.GENERIC('Account ID QR code'), async () => {
    await alice1.clickOnElementAll(new PlusButton(alice1));
    await sleepFor(500);
    return alice1.getScreenshot();
  });
  await test.step(TestSteps.NEW_CONVERSATION.NEW_MESSAGE, async () => {
    await bob1.injectImageToScene(base64);
    await bob1.clickOnElementAll(new PlusButton(bob1));
    await bob1.clickOnElementAll(new NewMessageOption(bob1));
    await bob1.clickOnElementAll(new ScanQRTab(bob1));
    await bob1.clickOnElementAll(new GrantCameraAccessButton(bob1));
    await bob1.clickOnElementAll(new ImagePermissionsModalAllow(bob1));
  });
  await test.step(`Verify conversation with ${alice.userName} opened`, async () => {
    const truncatedPubkey = truncatePubkey(alice.accountID, platform);
    await bob1.waitForTextElementToBePresent(new ConversationHeaderName(bob1, truncatedPubkey));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}

async function qrCodeCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_bob1_notfriends({ platform, testInfo });
  });
  const base64 = await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await joinCommunity(alice1, communities.testCommunity.link, communities.testCommunity.name);
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await clickOnCoordinates(alice1, InteractionPoints.AndroidConvoSettingsQRCode);
    await sleepFor(500);
    return alice1.getScreenshot();
  });
  await test.step(`${bob.userName} joins community via QR scan`, async () => {
    await bob1.clickOnElementAll(new PlusButton(bob1));
    await bob1.injectImageToScene(base64);
    await bob1.clickOnElementAll(new JoinCommunityOption(bob1));
    await bob1.clickOnElementAll(new ScanQRTab(bob1));
    await bob1.clickOnElementAll(new GrantCameraAccessButton(bob1));
    await bob1.clickOnElementAll(new ImagePermissionsModalAllow(bob1));
  });
  await test.step(`Verify ${bob.userName} joined the community`, async () => {
    await bob1.waitForTextElementToBePresent(
      new ConversationHeaderName(bob1, communities.testCommunity.name)
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
