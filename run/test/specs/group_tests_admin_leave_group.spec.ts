import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { ConversationSettings, EmptyConversation } from './locators/conversation';
import {
  DeleteGroupConfirm,
  LeaveGroupCancel,
  LeaveGroupConfirm,
  LeaveGroupMenuItem,
} from './locators/groups';
import { ConversationItem, PlusButton } from './locators/home';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

androidIt({
  title: 'Leave group as the only admin',
  risk: 'high',
  testCb: deleteGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Leave/Delete Group',
  },
  allureDescription: `Verifies that a solo admin can't leave a group but is instead prompted to add admins or delete the group.`,
});

async function deleteGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
        englishStrippedStr('groupLeave').toString(),
        englishStrippedStr('groupOnlyAdminLeave').withArgs({ group_name: testGroupName }).toString()
      );
      // Seems like this modal still has the leave group qa-tags so we're making sure they're the right text
      await alice1.waitForTextElementToBePresent({
        ...new LeaveGroupConfirm(alice1).build(),
        text: englishStrippedStr('addAdmin').withArgs({ count: 1 }).toString(),
      });
      await alice1.waitForTextElementToBePresent({
        ...new LeaveGroupCancel(alice1).build(),
        text: englishStrippedStr('groupDelete').toString(),
      });
    });
    await alice1.clickOnElementAll(new LeaveGroupCancel(alice1));
  });
  await test.step('Admin deletes group from Leave Group modal', async () => {
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Delete Group'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('groupDelete').toString(),
        englishStrippedStr('groupDeleteDescription')
          .withArgs({ group_name: testGroupName })
          .toString()
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
          text: englishStrippedStr('groupDeletedMemberDescription')
            .withArgs({ group_name: testGroupName })
            .toString(),
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
