import { test, TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { communities } from '../../constants/community';
import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { JoinCommunityModalButton } from '../locators';
import { ConversationHeaderName, MessageBody } from '../locators/conversation';
import { CreateGroupButton, GroupNameInput } from '../locators/groups';
import { PlusButton } from '../locators/home';
import {
  CreateGroupOption,
  EnterAccountID,
  NewMessageOption,
  NextButton,
} from '../locators/start_conversation';
import { joinCommunity } from '../utils/community';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

androidIt({
  title: 'Community URL on New Message - not member',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: communityURLNewConvo,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'Join Community',
  },
});

androidIt({
  title: 'Join Community URL on Create Group - not member',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: communityURLGroup,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'Join Community',
  },
});

androidIt({
  title: 'Community URL on New Message - member',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: communityURLNewConvoMember,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'Join Community',
  },
});

androidIt({
  title: 'Join Community URL on Create Group - member',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: communityURLGroupMember,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'Join Community',
  },
});

async function communityURLNewConvo(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step('Type Community URL in Create Group screen', async () => {
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new NewMessageOption(device));
    await device.inputText(communities.testCommunity.link, new EnterAccountID(device));
    await device.clickOnElementAll(new NextButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Join Community'), async () => {
    await device.checkModalStrings(
      tStripped('communityJoin'),
      tStripped('communityUrlJoinEntered')
    );
  });
  await test.step('Verify Community can be joined', async () => {
    await device.clickOnElementAll(new JoinCommunityModalButton(device));
    await device.waitForTextElementToBePresent(
      new ConversationHeaderName(device, communities.testCommunity.name)
    );
    await device.waitForTextElementToBePresent(new MessageBody(device));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function communityURLGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step('Type Community URL in New Message screen', async () => {
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new CreateGroupOption(device));
    await device.inputText(communities.testCommunity.link, new GroupNameInput(device));
    await device.clickOnElementAll(new CreateGroupButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Join Community'), async () => {
    await device.checkModalStrings(
      tStripped('communityJoin'),
      tStripped('groupNameContainedUrlJoinCommunity')
    );
  });
  await test.step('Verify Community can be joined', async () => {
    await device.clickOnElementAll(new JoinCommunityModalButton(device));
    await device.waitForTextElementToBePresent(
      new ConversationHeaderName(device, communities.testCommunity.name)
    );
    await device.waitForTextElementToBePresent(new MessageBody(device));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function communityURLNewConvoMember(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await joinCommunity(device, communities.testCommunity.link, communities.testCommunity.name);
    await device.navigateBack();
  });
  await test.step('Type Community URL in Create Group screen', async () => {
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new NewMessageOption(device));
    await device.inputText(communities.testCommunity.link, new EnterAccountID(device));
    await device.clickOnElementAll(new NextButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Join Community'), async () => {
    await device.checkModalStrings(
      tStripped('openCommunity'),
      tStripped('communityUrlOpenEntered', { community_name: communities.testCommunity.name })
    );
  });
  await test.step('Verify Community can be opened', async () => {
    await device.clickOnElementAll({
      strategy: '-android uiautomator',
      selector: `new UiSelector().text("Open")`,
    });
    await device.waitForTextElementToBePresent(
      new ConversationHeaderName(device, communities.testCommunity.name)
    );
    await device.waitForTextElementToBePresent(new MessageBody(device));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function communityURLGroupMember(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await joinCommunity(device, communities.testCommunity.link, communities.testCommunity.name);
    await device.navigateBack();
  });
  await test.step('Type Community URL in New Message screen', async () => {
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new CreateGroupOption(device));
    await device.inputText(communities.testCommunity.link, new GroupNameInput(device));
    await device.clickOnElementAll(new CreateGroupButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Join Community'), async () => {
    await device.checkModalStrings(
      tStripped('openCommunity'),
      tStripped('groupNameContainedUrlOpenCommunity', {
        community_name: communities.testCommunity.name,
      })
    );
  });
  await test.step('Verify Community can be opened', async () => {
    await device.clickOnElementAll({
      strategy: '-android uiautomator',
      selector: `new UiSelector().text("Open")`,
    });
    await device.waitForTextElementToBePresent(
      new ConversationHeaderName(device, communities.testCommunity.name)
    );
    await device.waitForTextElementToBePresent(new MessageBody(device));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
