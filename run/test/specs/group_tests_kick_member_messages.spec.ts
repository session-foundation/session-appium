import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ConversationSettings,
  DeletedMessage,
  EmptyConversation,
  MessageBody,
  MessageInput,
} from '../locators/conversation';
import {
  ConfirmRemovalButton,
  GroupMember,
  ManageMembersMenuItem,
  RemoveMemberButton,
  RemoveMemberMessagesRadial,
} from '../locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

// This functionality only exists on Android at the moment
androidIt({
  title: 'Kick and remove messages',
  risk: 'medium',
  testCb: kickMemberDeleteMsg,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription:
    'Verifies that a group member can be kicked from a group and that the kicked member is removed from the group (with their messages deleted).',
});

async function kickMemberDeleteMsg(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Kick member';
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice, bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo,
    });
  });
  const aliceMsg = `Hello I am ${alice.userName}`;
  const bobMsg = `Hello I am ${bob.userName}`;
  await test.step(`${alice.userName} and ${bob.userName} send a message to the group`, async () => {
    await alice1.sendMessage(aliceMsg);
    await bob1.sendMessage(bobMsg);
    await Promise.all(
      [alice1, bob1, charlie1].map(async device => {
        await device.waitForTextElementToBePresent(new MessageBody(device, aliceMsg));
        await device.waitForTextElementToBePresent(new MessageBody(device, bobMsg));
      })
    );
  });
  await test.step(TestSteps.USER_ACTIONS.GROUPS_REMOVE_MEMBER(bob.userName), async () => {
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new ManageMembersMenuItem(alice1));
    await alice1.clickOnElementAll({ ...new GroupMember(alice1).build(USERNAME.BOB) });
    await alice1.clickOnElementAll(new RemoveMemberButton(alice1));
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Remove Member'), async () => {
      await alice1.checkModalStrings(
        tStripped('remove'),
        tStripped('groupRemoveDescription', { name: USERNAME.BOB, group_name: testGroupName })
      );
    });
    await alice1.clickOnElementAll(new RemoveMemberMessagesRadial(alice1));
    await alice1.clickOnElementAll(new ConfirmRemovalButton(alice1));
    // The Group Member element sometimes disappears slowly, sometimes quickly.
    // hasElementBeenDeleted would be theoretically better but we just check if element is not there anymore
    await alice1.verifyElementNotPresent({
      ...new GroupMember(alice1).build(USERNAME.BOB),
      maxWait: 5_000,
    });
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
  await test.step(`Verify ${bob.userName} has been kicked and his message has been deleted`, async () => {
    await Promise.all(
      [alice1, charlie1].map(async device => {
        await device.waitForControlMessageToBePresent(
          tStripped('groupRemoved', { name: USERNAME.BOB })
        );
        await device.waitForTextElementToBePresent(new MessageBody(device, aliceMsg));
        await device.verifyElementNotPresent({
          ...new MessageBody(device, bobMsg).build(),
          maxWait: 1_000,
        });
        await device.waitForTextElementToBePresent(new DeletedMessage(device));
      })
    );
    await Promise.all([
      bob1.waitForTextElementToBePresent({
        ...new EmptyConversation(bob1).build(),
        text: tStripped('groupRemovedYou', { group_name: testGroupName }),
      }),
      bob1.verifyElementNotPresent(new MessageBody(bob1, aliceMsg)),
      bob1.verifyElementNotPresent(new MessageBody(bob1, bobMsg)),
      bob1.verifyElementNotPresent(new DeletedMessage(bob1)),
      bob1.verifyElementNotPresent({ ...new MessageInput(bob1).build(), maxWait: 1_000 }),
    ]);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
