import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationSettings, EmptyConversation } from './locators/conversation';
import { DeleteGroupConfirm, DeleteGroupMenuItem } from './locators/groups';
import { ConversationItem, PlusButton } from './locators/home';
import { open_Alice2_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete group linked device',
  risk: 'high',
  testCb: deleteGroup,
  countOfDevicesNeeded: 4,
  allureSuites: {
    parent: 'Groups',
    suite: 'Leave/Delete Group',
  },
  allureDescription: `Verifies that an admin can delete a group successfully via the UI.
  The group members see the empty state control message, and the admin's conversation disappears from the home screen, even on a linked device.`,
});

async function deleteGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Delete group';
  const {
    devices: { alice1, bob1, charlie1, alice2 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice2_Bob1_Charlie1_friends_group({
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
  await test.step(TestSteps.VERIFY.GROUP_DELETED, async () => {
    // Members
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
            ...new EmptyConversation(device).build(),
            text: englishStrippedStr('groupDeletedMemberDescription')
              .withArgs({ group_name: testGroupName })
              .toString(),
          })
        )
      );
    }
    // Admins
    await Promise.all(
      [alice1, alice2].map(async device => {
        await device.waitForTextElementToBePresent(new PlusButton(device)); // Ensure we're on the home screen
        await device.verifyElementNotPresent(new ConversationItem(device, testGroupName).build());
      })
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1, alice2);
  });
}
