import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ConversationSettings,
  DeleteContactConfirmButton,
  DeleteContactMenuItem,
  MessageBody,
} from '../locators/conversation';
import { ConversationItem, MessageRequestsBanner } from '../locators/home';
import { open_Alice2_Bob1_friends } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Delete contact from conversation settings',
  risk: 'high',
  testCb: deleteContactCS,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Delete Contact',
  },
});

async function deleteContactCS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: false, testInfo });
  });

  const { alice1, alice2, bob1 } = devices;
  const { alice, bob } = prebuilt;
  const newMessage = `This is a message from ${bob.userName} to ${alice.userName} after deleting contact`;

  await test.step('Verify conversation exists on alice1 and alice2', async () => {
    await Promise.all(
      [alice1, alice2].map(device =>
        device.waitForTextElementToBePresent(new ConversationItem(device, bob.userName))
      )
    );
  });

  await test.step('Delete contact from Conversation Settings on alice1', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    await alice1.scrollDown(); // Ensure Delete Contact is visible
    await alice1.clickOnElementAll(new DeleteContactMenuItem(alice1));
    await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
      await alice1.checkModalStrings(
        tStripped('contactDelete'),
        tStripped('deleteContactDescription', { name: USERNAME.BOB })
      );
    });
    await alice1.clickOnElementAll(new DeleteContactConfirmButton(alice1));
  });

  await test.step('Verify contact deleted on both alice devices', async () => {
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
    await bob1.sendMessage(newMessage);
  });

  await test.step('Verify conversation reappears as a message request on both alice devices', async () => {
    await Promise.all(
      [alice1, alice2].map(async device => {
        await device.clickOnElementAll(new MessageRequestsBanner(device));
        await device.clickOnByAccessibilityID('Message request');
        await device.waitForTextElementToBePresent(new MessageBody(device, newMessage));
      })
    );
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, alice2, bob1);
  });
}
