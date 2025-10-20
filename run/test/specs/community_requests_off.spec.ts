import { expect, TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { bothPlatformsIt } from '../../types/sessionIt';
import { newUser } from './utils/create_account';
import { joinCommunity } from './utils/join_community';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Community message requests off',
  risk: 'medium',
  testCb: blindedMessageRequests,
  countOfDevicesNeeded: 2,
  allureDescription:
    'Verifies that a message request cannot be sent when Community Message Requests are off.',
});

// TODO: tidy this up with neat locators
async function blindedMessageRequests(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
  await Promise.all([
    newUser(device1, USERNAME.ALICE, { saveUserData: false }),
    newUser(device2, USERNAME.BOB, { saveUserData: false }),
  ]);
  await Promise.all(
    [device1, device2].map(async device => {
      await joinCommunity(device, testCommunityLink, testCommunityName);
    })
  );
  const message = `I do not accept blinded message requests + ${platform} + ${Date.now()}`;
  await device2.sendMessage(message);
  // Click on profile picture (Android) or sender name (iOS)
  await device1
    .onAndroid()
    .clickOnElementXPath(
      `//android.view.ViewGroup[@resource-id='network.loki.messenger.qa:id/mainContainer'][.//android.widget.TextView[contains(@text,'${message}')]]//androidx.compose.ui.platform.ComposeView[@resource-id='network.loki.messenger.qa:id/profilePictureView']`
    );
  await device1
    .onIOS()
    .clickOnElementXPath(
      `//XCUIElementTypeCell[.//XCUIElementTypeOther[@name='Message body' and contains(@label,'${message}')]]//XCUIElementTypeStaticText[contains(@value,'(15')]`
    );

  let attr;

  if (platform === 'android') {
    const el = await device1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'account-id',
    });
    const elText = await device1.getTextFromElement(el);
    expect(elText).toMatch(/^15/);
    const messageButton = await device1.waitForTextElementToBePresent({
      strategy: 'xpath',
      selector: `//android.widget.TextView[@text="Message"]/parent::android.view.View`,
    });
    attr = await device1.getAttribute('enabled', messageButton.ELEMENT);
  } else {
    await device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Blinded ID',
    });
    const messageButton = await device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message',
    });
    attr = await device1.getAttribute('enabled', messageButton.ELEMENT);
  }
  if (attr !== 'false') {
    device1.log(`Message button attribute is 'enabled = ${attr}'`);
    throw new Error(`Message button should be disabled but it is not`);
  }
  await closeApp(device1, device2);
}
