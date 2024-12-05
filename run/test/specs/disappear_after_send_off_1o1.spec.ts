import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import {
  DisappearActions,
  DISAPPEARING_TIMES,
  DisappearModes,
  USERNAME,
} from '../../types/testing';
import {
  DisableDisappearingMessages,
  DisappearingMessagesMenuOption,
  DisappearingMessagesSubtitle,
  FollowSettingsButton,
  SetDisappearMessagesButton,
} from './locators/disappearing_messages';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt('Disappear after send off 1:1', 'high', disappearAfterSendOff1o1);

async function disappearAfterSendOff1o1(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const Alice = await linkedDevice(device1, device3, USERNAME.ALICE, platform);
  const mode: DisappearModes = 'send';
  const Bob = await newUser(device2, USERNAME.BOB, platform);
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Create user A and user B
  await newContact(platform, device1, Alice, device2, Bob);
  // Select disappearing messages option
  await setDisappearingMessage(
    platform,
    device1,
    ['1:1', `Disappear after ${mode} option`, time],
    device2
  );
  // Get control message based on key from json file
  await checkDisappearingControlMessage(
    platform,
    Alice,
    Bob,
    device1,
    device2,
    time,
    controlMode,
    device3
  );

  // Turned off disappearing messages on device 1
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'More options' });
  await device1.clickOnElementAll(new DisappearingMessagesMenuOption(device1));
  await device1.clickOnElementAll(new DisableDisappearingMessages(device1));
  await device1.clickOnElementAll(new SetDisappearMessagesButton(device1));
  await device1.onIOS().navigateBack();
  // Check control message for turning off disappearing messages
  // Check USER A'S CONTROL MESSAGE on device 1 and 3 (linked device)
  const disappearingMessagesTurnedOffYou = englishStripped(
    'disappearingMessagesTurnedOffYou'
  ).toString();
  // Check USER B'S CONTROL MESSAGE
  const disappearingMessagesTurnedOff = englishStripped('disappearingMessagesTurnedOff')
    .withArgs({ name: Alice.userName })
    .toString();
  await Promise.all([
    device1.disappearingControlMessage(disappearingMessagesTurnedOffYou),
    device2.disappearingControlMessage(disappearingMessagesTurnedOff),
    device3.disappearingControlMessage(disappearingMessagesTurnedOffYou),
  ]);
  // Follow setting on device 2
  await device2.clickOnElementAll(new FollowSettingsButton(device2));
  await sleepFor(500);
  await device2.checkModalStrings(
    englishStripped('disappearingMessagesFollowSetting').toString(),
    englishStripped('disappearingMessagesFollowSettingOff').toString(),
    true
  );
  await device2.clickOnElementAll({ strategy: 'accessibility id', selector: 'Confirm' });
  // Check conversation subtitle?
  await Promise.all([
    device1.doesElementExist({
      ...new DisappearingMessagesSubtitle(device1).build(),
      maxWait: 500,
    }),
    device2.doesElementExist({
      ...new DisappearingMessagesSubtitle(device2).build(),
      maxWait: 500,
    }),
    device3.doesElementExist({
      ...new DisappearingMessagesSubtitle(device3).build(),
      maxWait: 500,
    }),
  ]);
  await closeApp(device1, device2, device3);
}
