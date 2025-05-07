import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES } from '../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after send groups',
  risk: 'high',
  testCb: disappearAfterSendGroups,
  countOfDevicesNeeded: 3,
});

async function disappearAfterSendGroups(platform: SupportedPlatformsType) {
  const testGroupName = 'Disappear after send test';
  const testMessage = 'Testing disappear after sent in groups';
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });

  await setDisappearingMessage(platform, alice1, ['Group', `Disappear after send option`, time]);
  // Get correct control message for You setting disappearing messages
  const disappearingMessagesSetYou = englishStripped('disappearingMessagesSetYou')
    .withArgs({ time, disappearing_messages_type: controlMode })
    .toString();
  // Get correct control message for alice setting disappearing messages
  const disappearingMessagesSetControl = englishStripped('disappearingMessagesSet')
    .withArgs({ name: alice.userName, time, disappearing_messages_type: controlMode })
    .toString();
  // Check control message is correct on device 1, 2 and 3
  await Promise.all([
    alice1.disappearingControlMessage(disappearingMessagesSetYou),
    bob1.disappearingControlMessage(disappearingMessagesSetControl),
    charlie1.disappearingControlMessage(disappearingMessagesSetControl),
  ]);
  // Send message to verify deletion
  await alice1.sendMessage(testMessage);
  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
  ]);
  // Wait for 30 seconds
  await sleepFor(30000);
  // Check for test messages (should be deleted)
  await Promise.all([
    alice1.hasTextElementBeenDeleted('Message body', testMessage),
    bob1.hasTextElementBeenDeleted('Message body', testMessage),
    charlie1.hasTextElementBeenDeleted('Message body', testMessage),
  ]);
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}
