import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Mentions for groups',
  risk: 'medium',
  testCb: mentionsForGroups,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Mentions',
  },
  allureDescription:
    'Verifies that mentions can be sent to a group, and that all participants see them correctly.',
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
  await bob1.waitForTextElementToBePresent(new MessageBody(bob1, '@You'));
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
