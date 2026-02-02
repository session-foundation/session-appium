import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import { Contact } from './locators/global';
import {
  ConfirmPromotionModalButton,
  ManageAdminsMenuItem,
  PromoteMemberFooterButton,
  PromoteMemberModalConfirm,
  PromoteMembersMenuItem,
} from './locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sortByPubkey } from './utils/get_account_id';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

androidIt({
  title: 'Promote to admin (one member)',
  risk: 'medium',
  testCb: promoteSoloToAdmin,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription: 'Verifies that a group member can be promoted to Admin.',
});

androidIt({
  title: 'Promote to admin (multiple members)',
  risk: 'medium',
  testCb: promoteMultiToAdmin,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription: 'Verifies that multiple members can be promoted to Admin in one action.',
});

// The newly promoted admin will set disappearing messages to verify they have admin powers
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const timerType = 'Disappear after send option';

async function promoteSoloToAdmin(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  await test.step(`${alice.userName} promotes ${bob.userName}`, async () => {
    // Navigate to Promote Members screen
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new ManageAdminsMenuItem(alice1));
    await alice1.clickOnElementAll(new PromoteMembersMenuItem(alice1));
    await alice1.clickOnElementAll(new Contact(alice1, 'Bob'));
    await alice1.clickOnElementAll(new PromoteMemberFooterButton(alice1));
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Promote'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('promote').toString(),
        englishStrippedStr('adminPromoteDescription').withArgs({ name: bob.userName }).toString()
      );
      // This is a string that's part of the modal but not part of the modal description element
      await alice1.waitForTextElementToBePresent({
        strategy: '-android uiautomator',
        selector: `new UiSelector().text("${englishStrippedStr('promoteAdminsWarning').toString()}")`,
      });
    });
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Confirm Promotion'), async () => {
      await alice1.clickOnElementAll(new PromoteMemberModalConfirm(alice1));
      await alice1.checkModalStrings(
        englishStrippedStr('confirmPromotion').toString(),
        englishStrippedStr('confirmPromotionDescription').toString()
      );
    });
    await alice1.clickOnElementAll(new ConfirmPromotionModalButton(alice1));
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
  await test.step('Verify every member sees the promotion control message', async () => {
    await Promise.all(
      [alice1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          englishStrippedStr('adminPromotedToAdmin').withArgs({ name: bob.userName }).toString(),
          30_000
        )
      )
    );
    await bob1.waitForControlMessageToBePresent(englishStrippedStr('groupPromotedYou').toString());
  });
  await test.step(`Verify ${bob.userName} has admin powers by setting disappearing messages`, async () => {
    // Check to see if Bob has admin powers by setting disappearing messages
    await setDisappearingMessage(platform, bob1, ['Group', timerType, time]);
    await Promise.all(
      [alice1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          englishStrippedStr('disappearingMessagesSet')
            .withArgs({ name: bob.userName, time, disappearing_messages_type: 'sent' })
            .toString(),
          30_000
        )
      )
    );
    await bob1.waitForControlMessageToBePresent(
      englishStrippedStr('disappearingMessagesSetYou')
        .withArgs({ time, disappearing_messages_type: 'sent' })
        .toString()
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}

async function promoteMultiToAdmin(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice, bob, charlie },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo,
    });
  });
  const [firstUser, secondUser] = sortByPubkey(bob, charlie);
  await test.step(`${alice.userName} promotes ${bob.userName} and ${charlie.userName}`, async () => {
    // Navigate to Promote Members screen
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll(new ManageAdminsMenuItem(alice1));
    await alice1.clickOnElementAll(new PromoteMembersMenuItem(alice1));
    await alice1.clickOnElementAll(new Contact(alice1, 'Bob'));
    await alice1.clickOnElementAll(new Contact(alice1, 'Charlie'));
    await alice1.clickOnElementAll(new PromoteMemberFooterButton(alice1));
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Promote'), async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('promote').toString(),
        englishStrippedStr('adminPromoteTwoDescription')
          .withArgs({ name: firstUser, other_name: secondUser })
          .toString()
      );
      // This is a string that's part of the modal but not part of the modal description element
      await alice1.waitForTextElementToBePresent({
        strategy: '-android uiautomator',
        selector: `new UiSelector().text("${englishStrippedStr('promoteAdminsWarning').toString()}")`,
      });
    });
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Confirm Promotion'), async () => {
      await alice1.clickOnElementAll(new PromoteMemberModalConfirm(alice1));
      await alice1.checkModalStrings(
        englishStrippedStr('confirmPromotion').toString(),
        englishStrippedStr('confirmPromotionDescription').toString()
      );
    });
    await alice1.clickOnElementAll(new ConfirmPromotionModalButton(alice1));
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
  await test.step('Verify every member sees the promotion control message', async () => {
    await Promise.all([
      alice1.waitForControlMessageToBePresent(
        englishStrippedStr('adminTwoPromotedToAdmin')
          .withArgs({ name: firstUser, other_name: secondUser })
          .toString()
      ),
      bob1.waitForControlMessageToBePresent(
        englishStrippedStr('groupPromotedYouTwo')
          .withArgs({ other_name: charlie.userName })
          .toString()
      ),
      charlie1.waitForControlMessageToBePresent(
        englishStrippedStr('groupPromotedYouTwo').withArgs({ other_name: bob.userName }).toString()
      ),
    ]);
  });
  await test.step(`Verify ${bob.userName} has admin powers by setting disappearing messages`, async () => {
    // Check to see if Bob has admin powers by setting disappearing messages
    await setDisappearingMessage(platform, bob1, ['Group', timerType, time]);
    await Promise.all(
      [alice1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          englishStrippedStr('disappearingMessagesSet')
            .withArgs({ name: bob.userName, time, disappearing_messages_type: 'sent' })
            .toString(),
          30_000
        )
      )
    );
    await bob1.waitForControlMessageToBePresent(
      englishStrippedStr('disappearingMessagesSetYou')
        .withArgs({ time, disappearing_messages_type: 'sent' })
        .toString()
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
