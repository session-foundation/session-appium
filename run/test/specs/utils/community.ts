import test from '@playwright/test';

import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { CommunityInput, JoinCommunityButton } from '../locators';
import { ConversationHeaderName, EmptyConversation } from '../locators/conversation';
import { PlusButton } from '../locators/home';
import { JoinCommunityOption } from '../locators/start_conversation';

export const joinCommunity = async (
  device: DeviceWrapper,
  communityLink: string,
  communityName: string
) => {
  await device.clickOnElementAll(new PlusButton(device));
  await device.clickOnElementAll(new JoinCommunityOption(device));
  await device.inputText(communityLink, new CommunityInput(device));
  await device.clickOnElementAll(new JoinCommunityButton(device));
  await device.waitForTextElementToBePresent(new ConversationHeaderName(device, communityName));
  await device.verifyElementNotPresent(new EmptyConversation(device)); // checking that messages loaded already
  await device.scrollToBottom();
};

export function assertAdminIsKnown() {
  if (!process.env.SOGS_ADMIN_SEED) {
    console.error('SOGS_ADMIN_SEED required. In CI this is a GitHub secret.');
    console.error('Locally, set a known admin seed as an env var to run this test.');
    test.skip();
  }
}
