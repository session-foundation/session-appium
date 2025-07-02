import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationHeaderName } from './locators/conversation';
import { ConversationItem } from './locators/home';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { closeApp, openAppFourDevices, SupportedPlatformsType } from './utils/open_app';
import { restoreAccount } from './utils/restore_account';

bothPlatformsIt({
  title: 'Restore group',
  risk: 'high',
  testCb: restoreGroup,
  countOfDevicesNeeded: 4,
});
async function restoreGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Restore group';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform, testInfo);
  const [alice, bob, charlie] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  await createGroup(platform, device1, alice, device2, bob, device3, charlie, testGroupName);

  const aliceMessage = `${USERNAME.ALICE} to ${testGroupName}`;
  const bobMessage = `${USERNAME.BOB} to ${testGroupName}`;
  const charlieMessage = `${USERNAME.CHARLIE} to ${testGroupName}`;
  await restoreAccount(device4, alice);
  //   Check that group has loaded on linked device
  await device4.clickOnElementAll(new ConversationItem(device4, testGroupName));
  // Check the group name has loaded
  await device4.waitForTextElementToBePresent(
    new ConversationHeaderName(device4).build(testGroupName)
  );
  // Check all messages are present
  await Promise.all([
    device4.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: aliceMessage,
    }),
    device4.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: bobMessage,
    }),
    device4.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: charlieMessage,
    }),
  ]);
  const testMessage2 = 'Checking that message input is working';
  await device4.sendMessage(testMessage2);
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: testMessage2,
      })
    )
  );
  await closeApp(device1, device2, device3, device4);
}
