import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { androidIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import { Contact } from './locators/global';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

androidIt({
  title: 'Promote to admin',
  risk: 'medium',
  testCb: promoteToAdmin,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription: 'Verifies that a group member can be promoted to Admin.',
});

const time = DISAPPEARING_TIMES.ONE_MINUTE;
const timerType = 'Disappear after send option';

// TODO proper locator classes, test.steps
async function promoteToAdmin(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  // Navigate to Promote Members screen
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll({
    strategy: 'id',
    selector: 'manage-admins-menu-option',
  });
  await alice1.clickOnElementAll({
    strategy: 'id',
    selector: 'promote-members-menu-option',
  });
  await alice1.clickOnElementAll(new Contact(alice1, 'Bob'));
  await alice1.clickOnElementAll({
    strategy: 'id',
    selector: 'qa-collapsing-footer-action_promote',
  });
  await alice1.checkModalStrings(
    englishStrippedStr('promote').toString(),
    englishStrippedStr('adminPromoteDescription').withArgs({ name: bob.userName }).toString()
  );
  await alice1.waitForTextElementToBePresent({
    strategy: '-android uiautomator',
    selector: `new UiSelector().text("${englishStrippedStr('promoteAdminsWarning').toString()}")`,
  });
  await alice1.clickOnElementAll({
    strategy: 'id',
    selector: 'Promote',
  });
  await alice1.clickOnElementAll({
    strategy: 'id',
    selector: 'Confirm',
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForControlMessageToBePresent(
        englishStrippedStr('adminPromotedToAdmin').withArgs({ name: bob.userName }).toString(),
        30_000
      )
    )
  );
  await bob1.waitForControlMessageToBePresent(englishStrippedStr('groupPromotedYou').toString());
  // Check to see if Bob has admin powers by setting disappearing messages
  await setDisappearingMessage(platform, bob1, ['Group', timerType, time]);
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForControlMessageToBePresent(
        englishStrippedStr('disappearingMessagesSet')
          .withArgs({ name: bob.userName, time, disappearing_messages_type: 'sent' })
          .toString()
      )
    )
  );
  await bob1.waitForControlMessageToBePresent(
    englishStrippedStr('disappearingMessagesSetYou')
      .withArgs({ time, disappearing_messages_type: 'sent' })
      .toString()
  );
  await closeApp(alice1, bob1, charlie1);
}
