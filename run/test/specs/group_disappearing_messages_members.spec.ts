import { bothPlatformsIt } from '../../types/sessionIt';
import { openAppThreeDevices, SupportedPlatformsType, closeApp } from './utils/open_app';
import { newUser } from './utils/create_account';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { createGroup } from './utils/create_group';
import { ConversationSettings } from './locators/conversation';
import {
  DisappearingMessagesMenuOption,
  SetDisappearMessagesButton,
} from './locators/disappearing_messages';

bothPlatformsIt('Group member disappearing messages', 'medium', membersCantSetDisappearingMessages);

async function membersCantSetDisappearingMessages(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const testGroupName = 'Test group';
  // Create user A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // A creates group with B and C
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  // Member B navigates to DM settings
  await device2.clickOnElementAll(new ConversationSettings(device2));
  await device2.clickOnElementAll(new DisappearingMessagesMenuOption(device2));
  // On iOS, the Set button becomes visible after an admin clicks on a timer option
  // This is a 'fake' click on a disabled radial to rule out the false positive of the Set button becoming visible
  // On Android, this is not necessary because the button is always visible for admins
  await device2.onIOS().clickOnElementAll({
    strategy: 'accessibility id',
    selector: `${DISAPPEARING_TIMES.ONE_DAY} - Radio`, // I tried making this a locator class but I couldn't get it to work
  });
  const setButton = await device2.doesElementExist(new SetDisappearMessagesButton(device2));
  if (setButton) throw new Error('Disappearing Messages Set button should not be visible');
  await closeApp(device1, device2, device3);
}
