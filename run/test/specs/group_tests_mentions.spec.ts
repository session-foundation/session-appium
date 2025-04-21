import { bothPlatformsIt } from '../../types/sessionIt';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Mentions for groups',
  risk: 'medium',
  testCb: mentionsForGroups,
  countOfDevicesNeeded: 3,
});

async function mentionsForGroups(platform: SupportedPlatformsType) {
  const testGroupName = 'Mentions test group';
  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA, userB, userC },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });

  await device1.mentionContact(platform, userB);
  // Check format on User B's device
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: `@You`,
  });
  // await device2.findMessageWithBody(`@You`);
  // Bob to Select User C
  await device2.mentionContact(platform, userC);
  // Check Charlies device(3) for correct format
  await device3.findMessageWithBody(`@You`);
  //  Check User A format works
  await device3.mentionContact(platform, userA);
  // Check device 1 that correct format is shown (Alice's device)
  await device1.findMessageWithBody(`@You`);
  // Close app
  await closeApp(device1, device2, device3);
}
