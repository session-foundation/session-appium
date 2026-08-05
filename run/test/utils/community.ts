import { test } from '@playwright/test';

import { getCommunities } from '../../constants/community';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CommunityInput, JoinCommunityButton } from '../locators';
import { ConversationHeaderName, MessageBody } from '../locators/conversation';
import { ConversationItem, PlusButton } from '../locators/home';
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

/**
 * Leave `device` inside the community's conversation, joining it first if it isn't there already.
 *
 * Accounts restored from a seed (the SOGS admin) may or may not have the community yet, depending
 * on what their config sync has restored, so both outcomes are expected. Both paths assert the
 * conversation actually opened before returning: an iOS tap that silently doesn't register would
 * otherwise leave the caller on the home screen and surface several steps later as a missing
 * message, which points at entirely the wrong thing.
 */
export const openOrJoinCommunity = async (
  device: DeviceWrapper,
  communityLink: string,
  communityName: string
) => {
  const alreadyJoined = await device.doesElementExist(new ConversationItem(device, communityName));
  if (!alreadyJoined) {
    await joinCommunity(device, communityLink, communityName);
    return;
  }
  await device.clickOnElementAll(new ConversationItem(device, communityName));
  await device.waitForTextElementToBePresent(new ConversationHeaderName(device, communityName));
  await device.scrollToBottom();
};

export const joinCommunities = async (device: DeviceWrapper, toJoin: number) => {
  const communities = getCommunities();
  const available = Object.values(communities).length;
  if (toJoin > available) {
    throw new Error(
      `joinCommunities: requested ${toJoin} but only ${available} communities have been recorded.\nCheck run/constants/community.ts for more`
    );
  }
  for (const community of Object.values(communities).slice(0, toJoin)) {
    await joinCommunity(device, community.link, community.name);
    await device.navigateBack();
  }
};
