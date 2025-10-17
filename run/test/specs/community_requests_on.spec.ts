import { expect, TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { CloseSettings } from './locators';
import { ConversationHeaderName, MessageBody } from './locators/conversation';
import { MessageRequestsBanner } from './locators/home';
import { PrivacyMenuItem, UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { joinCommunity } from './utils/join_community';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Blinded message request',
  risk: 'medium',
  testCb: blindedMessageRequests,
  countOfDevicesNeeded: 2,
  allureDescription:
    'Verifies that a message request can be sent when Community Message Requests are on.',
  allureLinks: {
    ios: 'SES-4722',
  },
});

// TODO: tidy this up with neat locators
async function blindedMessageRequests(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
  const [alice, bob] = await Promise.all([
    newUser(device1, USERNAME.ALICE, { saveUserData: false }),
    newUser(device2, USERNAME.BOB, { saveUserData: false }),
  ]);
  await device2.clickOnElementAll(new UserSettings(device2));
  await device2.clickOnElementAll(new PrivacyMenuItem(device2));
  await device2.onAndroid().clickOnElementAll({
    strategy: '-android uiautomator',
    selector: 'new UiSelector().text("Community Message Requests")',
  });
  await device2.onIOS().clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Community Message Requests',
  });
  await device2.navigateBack();
  await device2.clickOnElementAll(new CloseSettings(device2));
  await Promise.all(
    [device1, device2].map(async device => {
      await joinCommunity(device, testCommunityLink, testCommunityName);
    })
  );
  const message = `I accept blinded message requests + ${platform} + ${Date.now()}`;
  await device2.sendMessage(message);
  await device2.navigateBack();
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
  if (platform === 'android') {
    const el = await device1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'account-id',
    });
    const elText = await device1.getTextFromElement(el);
    expect(elText).toMatch(/^15/);
    await device1.clickOnElementAll({
      strategy: '-android uiautomator',
      selector: 'new UiSelector().text("Message")',
    });
  } else {
    await device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Blinded ID',
    });
    await device1.clickOnByAccessibilityID('Message');
  }

  await device1.clickOnElementAll(new ConversationHeaderName(device1, bob.userName));
  const messageRequestPendingDescription = englishStrippedStr(
    'messageRequestPendingDescription'
  ).toString();
  await device1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Control message',
    text: messageRequestPendingDescription,
  });
  await device1.onAndroid().waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger.qa:id/textSendAfterApproval',
    text: messageRequestPendingDescription,
  });
  await device1.sendMessage('Howdy partner');
  await device2.clickOnElementAll(new MessageRequestsBanner(device2));
  // Bob clicks on request conversation item
  await device2.clickOnByAccessibilityID('Message request');
  await device2.waitForTextElementToBePresent(new ConversationHeaderName(device2, alice.userName));
  const messageRequestsAcceptDescription = englishStrippedStr(
    'messageRequestsAcceptDescription'
  ).toString();
  await device2.onIOS().waitForControlMessageToBePresent(messageRequestsAcceptDescription);
  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger.qa:id/sendAcceptsTextView',
    text: messageRequestsAcceptDescription,
  });

  // Send message from Bob to Alice
  const acceptMessage = 'Howdy back';
  await device2.sendMessage(acceptMessage);
  await device1.waitForTextElementToBePresent(new MessageBody(device1, acceptMessage));
  await closeApp(device1, device2);
}
