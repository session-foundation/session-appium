import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import { DeleteGroupConfirm, DeleteGroupMenuItem } from './locators/groups';
import { ConversationItem } from './locators/home';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete group',
  risk: 'high',
  testCb: deleteGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Leave/Delete Group',
  },
  allureDescription: `Verifies that an admin can delete a group successfully via the UI.
  The group members see the empty state control message, and the admin's conversation disappears from the home screen.`,
});

async function deleteGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Delete group';
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
  await test.step('Admin deletes group', async () => {
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new DeleteGroupMenuItem(alice1));
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
  await test.step('Verify group is deleted for all members', async () => {
    if (platform === 'ios') {
      await Promise.all(
        [bob1, charlie1].map(device =>
          device.waitForControlMessageToBePresent(
            englishStrippedStr('groupDeletedMemberDescription')
              .withArgs({ group_name: testGroupName })
              .toString()
          )
        )
      );
    } else {
      // Android uses the empty state for this "control message"
      await Promise.all(
        [bob1, charlie1].map(device =>
          device.waitForTextElementToBePresent({
            strategy: 'accessibility id',
            selector: 'Empty list',
            text: englishStrippedStr('groupDeletedMemberDescription')
              .withArgs({ group_name: testGroupName })
              .toString(),
          })
        )
      );
    }
    await alice1.verifyElementNotPresent(new ConversationItem(alice1, testGroupName).build());
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
