import { bothPlatformsIt } from '../../types/sessionIt';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import {
  DisappearingMessageRadial,
  DisappearingMessagesMenuOption,
  SetDisappearMessagesButton,
} from './locators/disappearing_messages';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import type { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Group member disappearing messages',
  risk: 'medium',
  testCb: membersCantSetDisappearingMessages,
  countOfDevicesNeeded: 3,
});

async function membersCantSetDisappearingMessages(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const testGroupName = 'Testing disappearing messages';
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });

  // Member B navigates to DM settings
  await bob1.clickOnElementAll(new ConversationSettings(bob1));
  await bob1.clickOnElementAll(new DisappearingMessagesMenuOption(bob1));
  // On iOS, the Set button becomes visible after an admin clicks on a timer option
  // This is a 'fake' click on a disabled radial to rule out the false positive of the Set button becoming visible
  // On Android, this is not necessary because the button is always visible for admins
  await bob1
    .onIOS()
    .clickOnElementAll(new DisappearingMessageRadial(bob1, DISAPPEARING_TIMES.ONE_DAY));
  const setButton = await bob1.doesElementExist({
    ...new SetDisappearMessagesButton(bob1).build(),
    maxWait: 500,
  });
  if (setButton) throw new Error('Disappearing Messages Set button should not be visible');
  await closeApp(alice1, bob1, charlie1);
}
