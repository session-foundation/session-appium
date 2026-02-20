import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { ConversationSettings } from '../locators/conversation';
import { Contact } from '../locators/global';
import {
  ConfirmPromotionModalButton,
  ManageAdminsMenuItem,
  MemberStatus,
  PromoteMemberFooterButton,
  PromoteMemberModalConfirm,
  PromoteMembersMenuItem,
} from '../locators/groups';
import { ConversationItem } from '../locators/home';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../state_builder';
import { newUser } from '../utils/create_account';
import { createGroup } from '../utils/create_group';
import { sortByPubkey } from '../utils/get_account_id';
import { closeApp, openAppFourDevices, SupportedPlatformsType } from '../utils/open_app';
import { restoreAccount } from '../utils/restore_account';
import { setDisappearingMessage } from '../utils/set_disappearing_messages';

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
  title: 'Promote to admin (linked device)',
  risk: 'medium',
  testCb: promoteSoloLinked,
  countOfDevicesNeeded: 4,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription:
    'Verifies that a previously promoted admin has admin powers on their linked device.',
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
        tStripped('promote'),
        tStripped('adminPromoteDescription', { name: bob.userName })
      );
      // This is a string that's part of the modal but not part of the modal description element
      await alice1.waitForTextElementToBePresent({
        strategy: '-android uiautomator',
        selector: `new UiSelector().text("${tStripped('promoteAdminsWarning')}")`,
      });
    });
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Confirm Promotion'), async () => {
      await alice1.clickOnElementAll(new PromoteMemberModalConfirm(alice1));
      await alice1.checkModalStrings(
        tStripped('confirmPromotion'),
        tStripped('confirmPromotionDescription')
      );
    });
    await alice1.clickOnElementAll(new ConfirmPromotionModalButton(alice1));
    // This is not tied to Bob but they're the only admin this status can apply to
    await alice1.waitForTextElementToBePresent(
      new MemberStatus(alice1).build(tStripped('adminPromotionSent'))
    );
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
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
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new ManageAdminsMenuItem(alice1));
  await Promise.all([
    alice1.waitForTextElementToBePresent(new Contact(alice1, bob.userName)),
    alice1.verifyElementNotPresent(new MemberStatus(alice1).build(tStripped('adminPromotionSent'))),
    alice1.verifyElementNotPresent(
      new MemberStatus(alice1).build(tStripped('adminPromotionFailed'))
    ),
  ]);
  await alice1.navigateBack();
  await alice1.navigateBack();
  await test.step(`Verify ${bob.userName} has admin powers by setting disappearing messages`, async () => {
    // Check to see if Bob has admin powers by setting disappearing messages
    await setDisappearingMessage(platform, bob1, ['Group', timerType, time]);
    await Promise.all(
      [alice1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('disappearingMessagesSet', {
            name: bob.userName,
            time,
            disappearing_messages_type: 'sent',
          }),
          30_000
        )
      )
    );
    await bob1.waitForControlMessageToBePresent(
      tStripped('disappearingMessagesSetYou', { time, disappearing_messages_type: 'sent' })
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}

async function promoteSoloLinked(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform, testInfo);
  const [alice, bob, charlie] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  await createGroup(platform, device1, alice, device2, bob, device3, charlie, testGroupName);
  await test.step(`${alice.userName} promotes ${bob.userName}`, async () => {
    // Navigate to Promote Members screen
    await device1.clickOnElementAll(new ConversationSettings(device1));
    await device1.clickOnElementAll(new ManageAdminsMenuItem(device1));
    await device1.clickOnElementAll(new PromoteMembersMenuItem(device1));
    await device1.clickOnElementAll(new Contact(device1, bob.userName));
    await device1.clickOnElementAll(new PromoteMemberFooterButton(device1));
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Promote'), async () => {
      await device1.checkModalStrings(
        tStripped('promote'),
        tStripped('adminPromoteDescription', { name: bob.userName })
      );
      // This is a string that's part of the modal but not part of the modal description element
      await device1.waitForTextElementToBePresent({
        strategy: '-android uiautomator',
        selector: `new UiSelector().text("${tStripped('promoteAdminsWarning')}")`,
      });
    });
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Confirm Promotion'), async () => {
      await device1.clickOnElementAll(new PromoteMemberModalConfirm(device1));
      await device1.checkModalStrings(
        tStripped('confirmPromotion'),
        tStripped('confirmPromotionDescription')
      );
    });
    await device1.clickOnElementAll(new ConfirmPromotionModalButton(device1));
    // This is not tied to Bob but they're the only admin this status can apply to
    await device1.waitForTextElementToBePresent(
      new MemberStatus(device1).build(tStripped('adminPromotionSent'))
    );
  });
  await device1.navigateBack();
  await device1.navigateBack();
  await test.step('Verify every member sees the promotion control message', async () => {
    await Promise.all(
      [device1, device3].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('adminPromotedToAdmin', { name: bob.userName }),
          30_000
        )
      )
    );
    await device2.waitForControlMessageToBePresent(tStripped('groupPromotedYou'));
  });
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await device1.clickOnElementAll(new ManageAdminsMenuItem(device1));
  await Promise.all([
    device1.waitForTextElementToBePresent(new Contact(device1, bob.userName)),
    device1.verifyElementNotPresent(
      new MemberStatus(device1).build(tStripped('adminPromotionSent'))
    ),
    device1.verifyElementNotPresent(
      new MemberStatus(device1).build(tStripped('adminPromotionFailed'))
    ),
  ]);
  await device1.navigateBack();
  await device1.navigateBack();
  await test.step(`Verify ${bob.userName} has admin powers by setting disappearing messages`, async () => {
    // Check to see if Bob has admin powers by setting disappearing messages
    await setDisappearingMessage(platform, device2, ['Group', timerType, time]);
    await Promise.all(
      [device1, device3].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('disappearingMessagesSet', {
            name: bob.userName,
            time,
            disappearing_messages_type: 'sent',
          }),
          30_000
        )
      )
    );
    await device2.waitForControlMessageToBePresent(
      tStripped('disappearingMessagesSetYou', { time, disappearing_messages_type: 'sent' })
    );
  });
  await restoreAccount(device4, bob, 'bob2');
  await device4.clickOnElementAll(new ConversationItem(device4, testGroupName));
  await device4.clickOnElementAll(new ConversationSettings(device4));
  await device4.clickOnElementAll(new ManageAdminsMenuItem(device4));
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device1, device2, device3, device4);
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
        tStripped('promote'),
        tStripped('adminPromoteTwoDescription', { name: firstUser, other_name: secondUser })
      );
      // This is a string that's part of the modal but not part of the modal description element
      await alice1.waitForTextElementToBePresent({
        strategy: '-android uiautomator',
        selector: `new UiSelector().text("${tStripped('promoteAdminsWarning')}")`,
      });
    });
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Confirm Promotion'), async () => {
      await alice1.clickOnElementAll(new PromoteMemberModalConfirm(alice1));
      await alice1.checkModalStrings(
        tStripped('confirmPromotion'),
        tStripped('confirmPromotionDescription')
      );
    });
    await alice1.clickOnElementAll(new ConfirmPromotionModalButton(alice1));
    // This is not tied to Bob/Charlie but they're the only admin this status can apply to
    await alice1.waitForTextElementToBePresent(
      new MemberStatus(alice1).build(tStripped('adminPromotionSent'))
    );
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
  await test.step('Verify every member sees the promotion control message', async () => {
    await Promise.all([
      alice1.waitForControlMessageToBePresent(
        tStripped('adminTwoPromotedToAdmin', { name: firstUser, other_name: secondUser }),
        10_000
      ),
      bob1.waitForControlMessageToBePresent(
        tStripped('groupPromotedYouTwo', { other_name: charlie.userName }),
        45_000
      ),
      charlie1.waitForControlMessageToBePresent(
        tStripped('groupPromotedYouTwo', { other_name: bob.userName }),
        45_000
      ),
    ]);
  });
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new ManageAdminsMenuItem(alice1));
  await Promise.all([
    alice1.waitForTextElementToBePresent(new Contact(alice1, bob.userName)),
    alice1.waitForTextElementToBePresent(new Contact(alice1, charlie.userName)),
    alice1.verifyElementNotPresent({
      ...new MemberStatus(alice1).build(tStripped('adminPromotionSent')),
      maxWait: 10_000,
    }),
    alice1.verifyElementNotPresent(
      new MemberStatus(alice1).build(tStripped('adminPromotionFailed'))
    ),
  ]);
  await alice1.navigateBack();
  await alice1.navigateBack();
  await test.step(`Verify ${bob.userName} has admin powers by setting disappearing messages`, async () => {
    // Check to see if Bob has admin powers by setting disappearing messages
    await setDisappearingMessage(platform, bob1, ['Group', timerType, time]);
    await Promise.all(
      [alice1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('disappearingMessagesSet', {
            name: bob.userName,
            time,
            disappearing_messages_type: 'sent',
          }),
          30_000
        )
      )
    );
    await bob1.waitForControlMessageToBePresent(
      tStripped('disappearingMessagesSetYou', { time, disappearing_messages_type: 'sent' })
    );
  });
  await test.step(`Verify ${charlie.userName} has admin powers by setting disappearing messages`, async () => {
    // Check to see if Bob has admin powers by setting disappearing messages
    const charlieTime = DISAPPEARING_TIMES.TWELVE_HOURS;
    await setDisappearingMessage(platform, charlie1, ['Group', timerType, charlieTime]);
    await Promise.all(
      [alice1, bob1].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('disappearingMessagesSet', {
            name: charlie.userName,
            time: charlieTime,
            disappearing_messages_type: 'sent',
          }),
          30_000
        )
      )
    );
    await charlie1.waitForControlMessageToBePresent(
      tStripped('disappearingMessagesSetYou', {
        time: charlieTime,
        disappearing_messages_type: 'sent',
      })
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
