import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { ConversationSettings, EmptyConversation, MessageBody } from '../locators/conversation';
import { Contact } from '../locators/global';
import {
  ConfirmPromotionModalButton,
  DeleteGroupConfirm,
  LeaveGroupCancel,
  LeaveGroupConfirm,
  LeaveGroupMenuItem,
  ManageAdminsMenuItem,
  MemberStatus,
  PromoteMemberFooterButton,
  PromoteMemberModalConfirm,
  PromoteMembersMenuItem,
} from '../locators/groups';
import { ConversationItem, PlusButton } from '../locators/home';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../state_builder';
import { sleepFor } from '../utils';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

androidIt({
  title: 'Leave group as the only admin',
  risk: 'high',
  testCb: soloAdminLeave,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Leave/Delete Group',
  },
  allureDescription:
    "Verifies that a solo admin can't leave a group but is instead prompted to add admins or delete the group.",
});

androidIt({
  title: 'Leave group with more than one admin',
  risk: 'medium',
  testCb: multiAdminLeave,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Leave/Delete Group',
  },
  allureDescription:
    'Verifies that an admin can leave a group if there is more than one admin in the group.',
});

async function soloAdminLeave(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Leave group';
  const {
    devices: { alice1, bob1, charlie1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo,
    });
  });
  await test.step('Admin attempts to leave group', async () => {
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new LeaveGroupMenuItem(alice1));
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Leave Group'), async () => {
      await alice1.checkModalStrings(
        tStripped('groupLeave'),
        tStripped('groupOnlyAdminLeave', { group_name: testGroupName })
      );
      // Seems like this modal still has the leave group qa-tags so we're making sure they're the right text
      await alice1.waitForTextElementToBePresent({
        ...new LeaveGroupConfirm(alice1).build(),
        text: tStripped('addAdmin', { count: 1 }),
      });
      await alice1.waitForTextElementToBePresent({
        ...new LeaveGroupCancel(alice1).build(),
        text: tStripped('groupDelete'),
      });
    });
    await alice1.clickOnElementAll(new LeaveGroupCancel(alice1));
  });
  await test.step('Admin deletes group from Leave Group modal', async () => {
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Delete Group'), async () => {
      await alice1.checkModalStrings(
        tStripped('groupDelete'),
        tStripped('groupDeleteDescription', { group_name: testGroupName })
      );
    });
    await alice1.clickOnElementAll(new DeleteGroupConfirm(alice1));
  });
  await test.step(TestSteps.VERIFY.GROUP_DELETED, async () => {
    // Android uses the empty state for this "control message"
    await Promise.all(
      [bob1, charlie1].map(device =>
        device.waitForTextElementToBePresent({
          ...new EmptyConversation(device).build(),
          text: tStripped('groupDeletedMemberDescription', { group_name: testGroupName }),
        })
      )
    );
    await alice1.waitForTextElementToBePresent(new PlusButton(alice1)); // Ensure we're on the home screen
    await alice1.verifyElementNotPresent(new ConversationItem(alice1, testGroupName).build());
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}

async function multiAdminLeave(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
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
  const promoteMsg = `Gonna promote ${bob.userName} now`;
  await alice1.sendMessage(promoteMsg);
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, promoteMsg).build())
    )
  );
  await test.step(`${alice.userName} promotes ${bob.userName}`, async () => {
    // Navigate to Manage Admins screen
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new ManageAdminsMenuItem(alice1));
    await alice1.clickOnElementAll(new PromoteMembersMenuItem(alice1));
    await alice1.clickOnElementAll(new Contact(alice1, 'Bob'));
    await alice1.clickOnElementAll(new PromoteMemberFooterButton(alice1));
    await alice1.clickOnElementAll(new PromoteMemberModalConfirm(alice1));
    await alice1.clickOnElementAll(new ConfirmPromotionModalButton(alice1));
    // This is not tied to Bob but they're the only admin this status can apply to
    await alice1.waitForTextElementToBePresent(
      new MemberStatus(alice1).build(tStripped('adminPromotionSent'))
    );
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
  // SES-5178
  await test.step('Verify every member sees the promotion control message', async () => {
    await Promise.all(
      [alice1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('adminPromotedToAdmin', { name: bob.userName }),
          30_000
        )
      )
    );
    await bob1.waitForControlMessageToBePresent(tStripped('groupPromotedYou'));
  });
  await test.step('Verify promotion status is correct', async () => {
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new ManageAdminsMenuItem(alice1));
    await alice1.verifyElementNotPresent(
      new MemberStatus(alice1).build(tStripped('adminPromotionSent'))
    );
    await sleepFor(1_000);
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Leave Group'), async () => {
    await alice1.navigateBack();
    await alice1.clickOnElementAll(new LeaveGroupMenuItem(alice1));
    await alice1.checkModalStrings(
      tStripped('groupLeave'),
      tStripped('groupLeaveDescription', { group_name: testGroupName })
    );
  });
  await test.step(`${alice.userName} leaves the group`, async () => {
    await alice1.clickOnElementAll(new LeaveGroupConfirm(alice1));

    await Promise.all(
      [bob1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('groupMemberLeft', { name: alice.userName }),
          30_000
        )
      )
    );
    await alice1.waitForTextElementToBePresent(new PlusButton(alice1));
    await alice1.verifyElementNotPresent(new ConversationItem(alice1, testGroupName).build());
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
