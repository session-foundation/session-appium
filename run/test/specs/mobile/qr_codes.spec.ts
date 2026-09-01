import { test, type TestInfo } from '@playwright/test';

import { getCommunities } from '../../../constants/community';
import { TestSteps } from '../../../types/allure';
import { androidIt } from '../../../types/sessionIt';
import { InteractionPoints, USERNAME } from '../../../types/testing';
import {
  AccountIdQRCode,
  GrantCameraAccessButton,
  ImagePermissionsModalAllow,
  ScanQRTab,
} from '../../locators';
import { ConversationHeaderName, ConversationSettings } from '../../locators/conversation';
import { AccountIDDisplay, ContinueButton } from '../../locators/global';
import { PlusButton } from '../../locators/home';
import { AccountRestoreButton, FastModeRadio } from '../../locators/onboarding';
import { RecoveryPasswordMenuItem, UserSettings, ViewQR } from '../../locators/settings';
import { JoinCommunityOption, NewMessageOption } from '../../locators/start_conversation';
import { open_Alice1_bob1_notfriends } from '../../state_builder';
import { clickOnCoordinates, verify } from '../../utils';
import { joinCommunity } from '../../utils/community';
import { newUser } from '../../utils/create_account';
import { truncatePubkey } from '../../utils/get_account_id';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from '../../utils/open_app';
import { handleNotificationPermissions } from '../../utils/permissions';

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
  communityRooms: 1,
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
  const [base64] = await test.step(
    TestSteps.OPEN.GENERIC('Recovery Password QR code'),
    async () => {
      return Promise.all([
        (async () => {
          await device1.clickOnElementAll(new RecoveryPasswordMenuItem(device1));
          await device1.clickOnElementAll(new ViewQR(device1));
          // The code alone, not the whole screen: the poster is a fixed square, so a full screenshot
          // shrinks the code to whatever fraction of the frame the surrounding layout left it.
          const qr = await device1.waitForTextElementToBePresent(new AccountIdQRCode(device1));
          return device1.getElementScreenshot(qr.ELEMENT);
        })(),
        (async () => {
          await device2.clickOnElementAll(new AccountRestoreButton(device2));
        })(),
      ]);
    }
  );
  await test.step(TestSteps.SETUP.RESTORE_ACCOUNT(USERNAME.ALICE), async () => {
    // Before the camera opens, so a poster left behind by the last run cannot be decoded first.
    await device2.injectImageToScene(base64);
    await device2.clickOnElementAll(new ScanQRTab(device2));
    await device2.clickOnElementAll(new GrantCameraAccessButton(device2));
    await device2.clickOnElementAll(new ImagePermissionsModalAllow(device2));
    // Re-sent until the scan has moved the app on to the notification step.
    await device2.injectImageToSceneUntil(base64, async () =>
      Boolean(
        await device2.doesElementExist({
          ...new FastModeRadio(device2).build(),
          maxWait: 2000,
        })
      )
    );
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
  const truncatedPubkey = truncatePubkey(alice.sessionId, platform);
  // Both devices work at once: alice rendering her code has nothing to do with bob reaching the sheet he
  // will scan it from, and doing them in sequence left the second device idle for the whole capture.
  const [base64] = await test.step(TestSteps.OPEN.GENERIC('Account ID QR code'), async () => {
    return Promise.all([
      (async () => {
        await alice1.clickOnElementAll(new PlusButton(alice1));
        // The QR alone, not the whole screen. The virtual-scene poster is a fixed size, so a full
        // screenshot puts the code at whatever fraction of the frame the surrounding layout leaves it —
        // and a code that overflows the frame cannot be decoded however well the camera works.
        const qr = await alice1.waitForTextElementToBePresent(new AccountIdQRCode(alice1));
        return alice1.getElementScreenshot(qr.ELEMENT);
      })(),
      (async () => {
        await bob1.clickOnElementAll(new PlusButton(bob1));
        await bob1.clickOnElementAll(new NewMessageOption(bob1));
      })(),
    ]);
  });
  await test.step(TestSteps.NEW_CONVERSATION.NEW_MESSAGE, async () => {
    // Before the camera opens, so whatever the last run left on the poster cannot be decoded first: a
    // still-running emulator keeps its scene, and a scanner is quick enough to read the previous code
    // and open a conversation with the wrong account.
    await bob1.injectImageToScene(base64);
    await bob1.clickOnElementAll(new ScanQRTab(bob1));
    await bob1.clickOnElementAll(new GrantCameraAccessButton(bob1));
    await bob1.clickOnElementAll(new ImagePermissionsModalAllow(bob1));
    // Re-sent until the conversation is actually open: the first poster handed to a scene whose camera
    // has just started is drawn black. Finishes on the first send that works rather than on a timer.
    await bob1.injectImageToSceneUntil(base64, async () =>
      Boolean(
        await bob1.doesElementExist({
          ...new ConversationHeaderName(bob1, truncatedPubkey).build(),
          text: truncatedPubkey,
          maxWait: 2000,
        })
      )
    );
  });
  await test.step(`Verify conversation with ${alice.userName} opened`, async () => {
    await bob1.waitForTextElementToBePresent(new ConversationHeaderName(bob1, truncatedPubkey));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}

async function qrCodeCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const communities = getCommunities();
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_bob1_notfriends({ platform, testInfo });
  });
  const [base64] = await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    return Promise.all([
      (async () => {
        await joinCommunity(alice1, communities.testCommunity.link, communities.testCommunity.name);
        await alice1.clickOnElementAll(new ConversationSettings(alice1));
        await clickOnCoordinates(alice1, InteractionPoints.AndroidConvoSettingsQRCode);
        // The code alone, not the whole screen: the poster is a fixed square, so a full screenshot
        // shrinks the code to whatever fraction of the frame the surrounding layout left it.
        const qr = await alice1.waitForTextElementToBePresent(new AccountIdQRCode(alice1));
        return alice1.getElementScreenshot(qr.ELEMENT);
      })(),
      (async () => {
        await bob1.clickOnElementAll(new PlusButton(bob1));
        await bob1.clickOnElementAll(new JoinCommunityOption(bob1));
      })(),
    ]);
  });
  await test.step(`${bob.userName} joins community via QR scan`, async () => {
    // Before the camera opens, so a poster left behind by the last run cannot be decoded first.
    await bob1.injectImageToScene(base64);
    await bob1.clickOnElementAll(new ScanQRTab(bob1));
    await bob1.clickOnElementAll(new GrantCameraAccessButton(bob1));
    await bob1.clickOnElementAll(new ImagePermissionsModalAllow(bob1));
    await bob1.injectImageToSceneUntil(base64, async () =>
      Boolean(
        await bob1.doesElementExist({
          ...new ConversationHeaderName(bob1, communities.testCommunity.name).build(),
          text: communities.testCommunity.name,
          maxWait: 2000,
        })
      )
    );
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
