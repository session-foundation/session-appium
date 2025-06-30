import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, DisappearModes } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import {
  DisableDisappearingMessages,
  DisappearingMessagesMenuOption,
  DisappearingMessagesSubtitle,
  FollowSettingsButton,
  SetDisappearMessagesButton,
} from './locators/disappearing_messages';
import { open_Alice2_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after send off 1:1',
  risk: 'high',
  testCb: disappearAfterSendOff1o1,
  countOfDevicesNeeded: 3,
});

async function disappearAfterSendOff1o1(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, alice2, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: true });

  const mode: DisappearModes = 'send';
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Select disappearing messages option
  await setDisappearingMessage(
    platform,
    alice1,
    ['1:1', `Disappear after ${mode} option`, time],
    bob1
  );
  // Get control message based on key from json file
  await checkDisappearingControlMessage(
    platform,
    alice.userName,
    bob.userName,
    alice1,
    bob1,
    time,
    controlMode,
    alice2
  );

  // Turn off disappearing messages on device 1
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new DisappearingMessagesMenuOption(alice1));
  await alice1.clickOnElementAll(new DisableDisappearingMessages(alice1));
  await alice1.clickOnElementAll(new SetDisappearMessagesButton(alice1));
  await alice1.navigateBack();
  // Check control message for turning off disappearing messages
  // Check USER A'S CONTROL MESSAGE on device 1 and 3 (linked device)
  const disappearingMessagesTurnedOffYou = englishStrippedStr(
    'disappearingMessagesTurnedOffYou'
  ).toString();
  // Check USER B'S CONTROL MESSAGE
  const disappearingMessagesTurnedOff = englishStrippedStr('disappearingMessagesTurnedOff')
    .withArgs({ name: alice.userName })
    .toString();
  await Promise.all([
    alice1.disappearingControlMessage(disappearingMessagesTurnedOffYou),
    bob1.disappearingControlMessage(disappearingMessagesTurnedOff),
    alice2.disappearingControlMessage(disappearingMessagesTurnedOffYou),
  ]);
  // Follow setting on device 2
  await bob1.clickOnElementAll(new FollowSettingsButton(bob1));
  await sleepFor(500);
  await bob1.checkModalStrings(
    englishStrippedStr('disappearingMessagesFollowSetting').toString(),
    englishStrippedStr('disappearingMessagesFollowSettingOff').toString(),
    false
  );
  await bob1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Confirm' });
  // Check conversation subtitle?
  await Promise.all([
    alice1.doesElementExist({
      ...new DisappearingMessagesSubtitle(alice1).build(),
      maxWait: 500,
    }),
    bob1.doesElementExist({
      ...new DisappearingMessagesSubtitle(bob1).build(),
      maxWait: 500,
    }),
    alice2.doesElementExist({
      ...new DisappearingMessagesSubtitle(alice2).build(),
      maxWait: 500,
    }),
  ]);
  await closeApp(alice1, bob1, alice2);
}
