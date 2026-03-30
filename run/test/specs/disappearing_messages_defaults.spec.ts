import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, GROUPNAME, USERNAME } from '../../types/testing';
import { ConversationSettings } from '../locators/conversation';
import {
  DisappearingMessagesMenuOption,
  DisappearingMessagesTimerType,
} from '../locators/disappearing_messages';
import { PlusButton } from '../locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from '../locators/start_conversation';
import {
  open_Alice1_Bob1_Charlie1_friends_group,
  open_Alice1_Bob1_friends,
} from '../state_builder';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Disappearing messages defaults 1:1',
  risk: 'medium',
  testCb: disappearingMessagesDefaults1o1,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription: 'Verifies the default selected timer for each DM mode in a 1:1 conversation',
});

bothPlatformsIt({
  title: 'Disappearing messages defaults group',
  risk: 'medium',
  testCb: disappearingMessagesDefaultsGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription: 'Verifies the default selected timer in a group conversation',
});

bothPlatformsIt({
  title: 'Disappearing messages defaults note to self',
  risk: 'medium',
  testCb: disappearingMessagesDefaultsNoteToSelf,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription: 'Verifies the default selected timer in Note to Self',
});

async function disappearingMessagesDefaults1o1(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });

  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new DisappearingMessagesMenuOption(alice1));

  // Disappear after read: default should be 12 hours
  await alice1.clickOnElementAll(
    new DisappearingMessagesTimerType(alice1, 'Disappear after read option')
  );
  await alice1.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.TWELVE_HOURS);

  // Disappear after send: default should be 1 day
  await alice1.clickOnElementAll(
    new DisappearingMessagesTimerType(alice1, 'Disappear after send option')
  );
  await alice1.disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.ONE_DAY);

  await closeApp(alice1, bob1);
}

async function disappearingMessagesDefaultsGroup(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const testGroupName: GROUPNAME = 'Testing disappearing messages';
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });

  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new DisappearingMessagesMenuOption(alice1));

  // Group defaults: disappear after send should be OFF
  await alice1.onIOS().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_IOS);
  await alice1.onAndroid().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_ANDROID);

  await closeApp(alice1, bob1, charlie1);
}

async function disappearingMessagesDefaultsNoteToSelf(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const alice = await newUser(device, USERNAME.ALICE);

  await device.clickOnElementAll(new PlusButton(device));
  await device.clickOnElementAll(new NewMessageOption(device));
  await device.inputText(alice.accountID, new EnterAccountID(device));
  await device.scrollDown();
  await device.clickOnElementAll(new NextButton(device));

  await device.clickOnElementAll(new ConversationSettings(device));
  await device.clickOnElementAll(new DisappearingMessagesMenuOption(device));

  // Note to Self defaults: disappear after send should be OFF
  await device.onIOS().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_IOS);
  await device.onAndroid().disappearRadioButtonSelected(platform, DISAPPEARING_TIMES.OFF_ANDROID);

  await closeApp(device);
}
