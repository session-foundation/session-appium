import { bothPlatformsIt } from '../../types/sessionIt';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import {
  DisappearingMessageRadial,
  DisappearingMessagesMenuOption,
  SetDisappearMessagesButton,
} from './locators/disappearing_messages';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';

bothPlatformsIt({
  title: 'Group member disappearing messages',
  risk: 'medium',
  testCb: membersCantSetDisappearingMessages,
  countOfDevicesNeeded: 3,
});

async function membersCantSetDisappearingMessages(platform: SupportedPlatformsType) {
  const testGroupName = 'Testing disappearing messages';
  const {
    devices: { device1, device2, device3 },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });

  // Member B navigates to DM settings
  await device2.clickOnElementAll(new ConversationSettings(device2));
  await device2.clickOnElementAll(new DisappearingMessagesMenuOption(device2));
  // On iOS, the Set button becomes visible after an admin clicks on a timer option
  // This is a 'fake' click on a disabled radial to rule out the false positive of the Set button becoming visible
  // On Android, this is not necessary because the button is always visible for admins
  await device2
    .onIOS()
    .clickOnElementAll(new DisappearingMessageRadial(device2, DISAPPEARING_TIMES.ONE_DAY));
  const setButton = await device2.doesElementExist({
    ...new SetDisappearMessagesButton(device2).build(),
    maxWait: 500,
  });
  if (setButton) throw new Error('Disappearing Messages Set button should not be visible');
  await closeApp(device1, device2, device3);
}
