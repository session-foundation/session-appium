import test from '@playwright/test';

import { communities } from '../../constants/community';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CommunityInput, JoinCommunityButton } from '../locators';
import { ConversationHeaderName, MessageBody } from '../locators/conversation';
import { PlusButton } from '../locators/home';
import { JoinCommunityOption } from '../locators/start_conversation';

export function assertAdminIsKnown() {
  if (!process.env.SOGS_ADMIN_SEED) {
    console.error('SOGS_ADMIN_SEED required. In CI this is a GitHub secret.');
    console.error('Locally, set a known admin seed as an env var to run this test.');
    test.skip();
  }
}

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
  await device.waitForTextElementToBePresent(new MessageBody(device)); // Check for ANY message
  await device.scrollToBottom();
};

export const joinCommunities = async (device: DeviceWrapper, number: number) => {
  const available = Object.values(communities).length;
  if (number > available) {
    throw new Error(
      `joinCommunities: requested ${number} but only ${available} communities have been recorded.\nCheck run/constants/community.ts for more`
    );
  }
  for (const community of Object.values(communities).slice(0, number)) {
    await joinCommunity(device, community.link, community.name);
    await device.navigateBack();
  }
};
