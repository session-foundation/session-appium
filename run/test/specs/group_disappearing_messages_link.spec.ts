import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { LinkPreview, LinkPreviewMessage } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt('Disappearing link to group', 'low', disappearingLinkMessageGroup);

const timerType = 'Disappear after send option';
const time = DISAPPEARING_TIMES.THIRTY_SECONDS;

async function disappearingLinkMessageGroup(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const testGroupName = 'Testing disappearing messages';
  const testLink = `https://getsession.org/`;
  // Create user A and user B
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  await setDisappearingMessage(platform, device1, ['Group', timerType, time]);
  // Send a link
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Enable link preview modal appears as soon as link is typed on android but on iOS it appears after
  if (platform === 'android') {
    await device1.checkModalStrings(
      englishStripped('linkPreviewsEnable').toString(),
      englishStripped('linkPreviewsFirstDescription').withArgs({ app_name: 'Session' }).toString(),
      true
    );
    await device1.clickOnByAccessibilityID('Enable');
  }
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Sent',
    maxWait: 20000,
  });
  if (platform === 'ios') {
    await device1.checkModalStrings(
      englishStripped('linkPreviewsEnable').toString(),
      englishStripped('linkPreviewsFirstDescription').withArgs({ app_name: 'Session' }).toString()
    );
    await device1.clickOnByAccessibilityID('Enable');
  }
  // Accept dialog for link preview
  // No preview on first send
  await device1.clickOnByAccessibilityID('Send message button');
  // Send again for image
  await device1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  if (platform === 'ios') {
    await device1.waitForTextElementToBePresent(new LinkPreview(device1));
  } else {
    await sleepFor(1000);
  }
  await device1.clickOnByAccessibilityID('Send message button');
  // Make sure image preview is available in device 2
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testLink,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testLink,
    }),
  ]);
  // Wait for 30 seconds to disappear
  await sleepFor(30000);
  if (platform === 'ios') {
    await Promise.all(
      [device1, device2, device3].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          maxWait: 1000,
          text: testLink,
        })
      )
    );
  }
  if (platform === 'android') {
    await Promise.all(
      [device1, device2, device3].map(device =>
        device.hasElementBeenDeleted({ ...new LinkPreviewMessage(device).build(), maxWait: 1000 })
      )
    );
  }
  await closeApp(device1, device2, device3);
}
