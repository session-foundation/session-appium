import { bothPlatformsIt } from '../../types/sessionIt';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Mentions for groups',
  risk: 'medium',
  testCb: mentionsForGroups,
  countOfDevicesNeeded: 3,
});

async function mentionsForGroups(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Mentions test group';
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice, bob, charlie },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });

  await alice1.mentionContact(platform, bob);
  // Check format on User B's device
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: `@You`,
  });
  // await device2.findMessageWithBody(`@You`);
  // Bob to Select User C
  await bob1.mentionContact(platform, charlie);
  // Check Charlies device(3) for correct format
  await charlie1.findMessageWithBody(`@You`);
  //  Check User A format works
  await charlie1.mentionContact(platform, alice);
  // Check device 1 that correct format is shown (Alice's device)
  await alice1.findMessageWithBody(`@You`);
  // Close app
  await closeApp(alice1, bob1, charlie1);
}
