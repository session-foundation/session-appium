import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationItem } from './locators/home';
import { open_Alice2_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete conversation from conversation list',
  risk: 'high',
  testCb: deleteConversation,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Delete Conversation',
  },
});

async function deleteConversation(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: false, testInfo });
  });

  const { alice1, alice2, bob1 } = devices;
  const { alice, bob } = prebuilt;

  await test.step('Verify conversation exists on alice1 and alice2', async () => {
    await Promise.all(
      [alice1, alice2].map(device =>
        device.waitForTextElementToBePresent(new ConversationItem(device, bob.userName))
      )
    );
  });

  await test.step('Delete conversation from alice1', async () => {
    await alice1.onIOS().swipeLeft('Conversation list item', bob.userName);
    await alice1.onAndroid().longPressConversation(bob.userName);
    await alice1.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Delete',
    });
    await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('conversationsDelete').toString(),
        englishStrippedStr('deleteConversationDescription')
          .withArgs({ name: USERNAME.BOB })
          .toString(),
        false
      );
    });
    await alice1.clickOnByAccessibilityID('Delete');
  });

  await test.step('Verify conversation deleted on both alice devices', async () => {
    await Promise.all([
      alice1.verifyElementNotPresent({
        ...new ConversationItem(alice1, bob.userName).build(),
        maxWait: 5_000,
      }),
      alice2.hasElementBeenDeleted({
        ...new ConversationItem(alice2, bob.userName).build(),
        maxWait: 20_000,
      }),
    ]);
  });

  await test.step('Send message from Bob to Alice', async () => {
    await bob1.clickOnElementAll(new ConversationItem(bob1, alice.userName));
    await bob1.sendMessage('This is a new message');
  });

  await test.step('Verify conversation reappears on both alice devices', async () => {
    await Promise.all(
      [alice1, alice2].map(device =>
        device.waitForTextElementToBePresent(new ConversationItem(device, bob.userName))
      )
    );
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, alice2, bob1);
  });
}
