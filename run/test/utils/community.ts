import { test } from '@playwright/test';

import { getCommunities } from '../../constants/community';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CommunityInput, JoinCommunityButton } from '../locators';
import {
  ConversationHeaderName,
  ConversationSettings,
  LeaveCommunityConfirm,
  LeaveCommunityMenuItem,
  MessageBody,
} from '../locators/conversation';
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

/**
 * Leave a community, so the account's user-groups config does not keep it after the room is gone.
 *
 * The suite creates a per-test room and deletes it at the end, but nothing removed the JOIN — so the SOGS
 * admin, the one identity every community test reuses, accreted 27 dead rooms. That is not untidiness: the
 * client counts poll failures per POLL rather than per room, so any dead room drives that server's retry
 * interval to its 30s cap and holds it there, and a 30s cap against a 30s assertion is why
 * `Ban and unban user in community` failed while its sibling passed.
 *
 * Best-effort by design. It runs after the assertions a spec exists for, and an account left slightly dirty
 * is a smaller problem than a teardown turning a passing test red — but it logs loudly, because a cleanup
 * that silently stops working is how the 27 accumulated in the first place.
 */
export const leaveCommunity = async (device: DeviceWrapper, communityName: string) => {
  try {
    const inConversation = await device.doesElementExist({
      ...new ConversationHeaderName(device, communityName).build(),
      maxWait: 2_000,
    });
    if (!inConversation) {
      await device.clickOnElementAll(new ConversationItem(device, communityName));
      await device.waitForTextElementToBePresent(new ConversationHeaderName(device, communityName));
    }
    await device.clickOnElementAll(new ConversationSettings(device));
    await device.clickOnElementAll(new LeaveCommunityMenuItem(device));
    await device.clickOnElementAll(new LeaveCommunityConfirm(device));
    await device.waitForElementToBeGone({
      ...new ConversationItem(device, communityName).build(),
      maxWait: 10_000,
    });
    device.log(`Left community "${communityName}"`);
  } catch (error) {
    device.log(
      `Could not leave community "${communityName}", it stays in this account's config: ${(error as Error).message}`
    );
  }
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
