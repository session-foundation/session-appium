import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import {
  DisappearingMessagesSubtitle,
  FollowSettingsButton,
  SetModalButton,
} from '../locators/disappearing_messages';
import { open_Alice1_Bob1_friends } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';
import { setDisappearingMessage } from '../utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing messages follow setting 1:1',
  risk: 'medium',
  testCb: disappearingMessagesFollowSetting1o1,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription:
    'Verifies that Bob sees the Follow Setting banner when Alice sets disappearing messages in a 1:1 conversation, and that following applies the setting to both sides',
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingMessagesFollowSetting1o1(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });

  await setDisappearingMessage(alice1, ['1:1', timerType, time]);

  // Bob should see the follow settings banner after Alice sets DM
  await bob1.clickOnElementAll(new FollowSettingsButton(bob1));
  await bob1.checkModalStrings(
    tStripped('disappearingMessagesFollowSetting'),
    tStripped('disappearingMessagesFollowSettingOn', {
      time,
      disappearing_messages_type: 'sent',
    })
  );
  await bob1.clickOnElementAll(new SetModalButton(bob1));

  // Both should now show the DM subtitle
  await Promise.all(
    [alice1, bob1].map(device =>
      device.waitForTextElementToBePresent(new DisappearingMessagesSubtitle(device))
    )
  );

  await closeApp(alice1, bob1);
}
