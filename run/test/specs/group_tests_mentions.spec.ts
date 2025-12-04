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
  // Each user mentions the next user in the group
  // Verify: recipient sees @You, others see @username
  await alice1.mentionContact(platform, bob);
  await Promise.all([
    alice1.waitForTextElementToBePresent(new MessageBody(alice1, `@${bob.userName}`)),
    bob1.waitForTextElementToBePresent(new MessageBody(bob1, '@You')),
    charlie1.waitForTextElementToBePresent(new MessageBody(charlie1, `@${bob.userName}`)),
  ]);
  await bob1.mentionContact(platform, charlie);
  await Promise.all([
    alice1.waitForTextElementToBePresent(new MessageBody(alice1, `@${charlie.userName}`)),
    bob1.waitForTextElementToBePresent(new MessageBody(bob1, `@${charlie.userName}`)),
    charlie1.waitForTextElementToBePresent(new MessageBody(charlie1, '@You')),
  ]);
  await charlie1.mentionContact(platform, alice);
  await Promise.all([
    alice1.waitForTextElementToBePresent(new MessageBody(alice1, '@You')),
    bob1.waitForTextElementToBePresent(new MessageBody(bob1, `@${alice.userName}`)),
    charlie1.waitForTextElementToBePresent(new MessageBody(charlie1, `@${alice.userName}`)),
  ]);
  await closeApp(alice1, bob1, charlie1);
}
