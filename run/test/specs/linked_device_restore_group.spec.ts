import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationHeaderName, MessageBody } from './locators/conversation';
import { ConversationItem } from './locators/home';
import { open_Alice1_Bob1_friends_group_Unknown1 } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { restoreAccount } from './utils/restore_account';

bothPlatformsIt({
  title: 'Restore group',
  risk: 'high',
  testCb: restoreGroup,
  countOfDevicesNeeded: 3,
});
async function restoreGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Group to test adding contact';
  const aliceMessage = 'Hello this is alice';
  const bobMessage = 'Hello this is bob';
  const {
    devices: { alice1, bob1, unknown1 },
    prebuilt,
  } = await open_Alice1_Bob1_friends_group_Unknown1({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo: testInfo,
  });
  const alice = {
    userName: prebuilt.alice.userName,
    accountID: prebuilt.alice.sessionId,
    recoveryPhrase: prebuilt.alice.seedPhrase,
  };
  await alice1.sendMessage(aliceMessage);
  await bob1.sendMessage(bobMessage);
  unknown1.setDeviceIdentity('alice2');
  await restoreAccount(unknown1, alice);
  //   Check that group has loaded on linked device
  await unknown1.clickOnElementAll(new ConversationItem(unknown1, testGroupName));
  // Check the group name has loaded
  await unknown1.waitForTextElementToBePresent(new ConversationHeaderName(unknown1, testGroupName));
  // Check all messages are present
  await Promise.all([
    unknown1.waitForTextElementToBePresent(new MessageBody(unknown1, aliceMessage)),
    unknown1.waitForTextElementToBePresent(new MessageBody(unknown1, bobMessage)),
  ]);
  const testMessage2 = 'Checking that message input is working';
  await unknown1.sendMessage(testMessage2);
  await Promise.all(
    [alice1, bob1, unknown1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, testMessage2))
    )
  );
  await closeApp(alice1, bob1, unknown1, unknown1);
}
