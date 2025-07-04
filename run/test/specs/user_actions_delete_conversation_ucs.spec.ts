import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import { DeleteContactModalConfirm } from './locators/global';
import { ConversationItem } from './locators/home';
import { open_Alice2_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete conversation from conversation settings',
  risk: 'high',
  testCb: deleteConversationUCS,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Delete Contact',
  },
});

async function deleteConversationUCS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await test.step('Restore pre-seeded accounts', async () => {
    return await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: false, testInfo });
  });

  const { alice1, alice2, bob1 } = devices;
  const { alice, bob } = prebuilt;

  await test.step(`Verify conversation exists on alice1 and alice2`, async () => {
    await Promise.all([
      alice1.waitForTextElementToBePresent(new ConversationItem(alice1, bob.userName)),
      alice2.waitForTextElementToBePresent(new ConversationItem(alice2, bob.userName)),
    ]);
  });

  await test.step('Delete conversation from UCS on alice1', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Delete Conversation',
    });
    await test.step('Verify delete confirmation modal', async () => {
      await alice1.checkModalStrings(
        englishStrippedStr('conversationsDelete').toString(),
        englishStrippedStr('conversationsDeleteDescription')
          .withArgs({ name: USERNAME.BOB })
          .toString(),
        false
      );
    });
    await alice1.clickOnElementAll(new DeleteContactModalConfirm(alice1));
  });

  await test.step('Verify conversation deleted on both alice devices', async () => {
    await Promise.all([
      alice1.hasElementBeenDeleted({
        ...new ConversationItem(alice1, bob.userName).build(),
        maxWait: 3000,
      }),
      alice2.hasElementBeenDeleted({
        ...new ConversationItem(alice2, bob.userName).build(),
        maxWait: 3000,
      }),
    ]);
  });

  await test.step('Send message from Bob to Alice', async () => {
    await bob1.clickOnElementAll(new ConversationItem(bob1, alice.userName));
    await bob1.sendMessage('This is a new message');
  });

  await test.step('Verify conversation reappears on both alice devices', async () => {
    await Promise.all([
      alice1.waitForTextElementToBePresent(new ConversationItem(alice1, bob.userName)),
      alice2.waitForTextElementToBePresent(new ConversationItem(alice2, bob.userName)),
    ]);
  });

  await test.step('Close all apps', async () => {
    await closeApp(alice1, alice2, bob1);
  });
}
