import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
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
async function restoreGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Restore group';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform);
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);

  const userAMessage = `${USERNAME.ALICE} to ${testGroupName}`;
  const userBMessage = `${USERNAME.BOB} to ${testGroupName}`;
  const userCMessage = `${USERNAME.CHARLIE} to ${testGroupName}`;
  await restoreAccount(device4, userA);
  //   Check that group has loaded on linked device
  await device4.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testGroupName,
  });
  // Check the group name has loaded
  await device4.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
    text: testGroupName,
  });
  // Check all messages are present
  await Promise.all([
    device4.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userAMessage,
    }),
    device4.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userBMessage,
    }),
    device4.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userCMessage,
    }),
  ]);
  const testMessage2 = 'Checking that message input is working';
  await device4.sendMessage(testMessage2);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage2,
    }),
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage2,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage2,
    }),
  ]);
  await closeApp(device1, device2, device3, device4);
}
