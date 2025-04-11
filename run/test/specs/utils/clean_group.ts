import { englishStripped } from '../../../localizer/Localizer';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { LeaveGroupConfirm } from '../locators/groups';
import { SupportedPlatformsType } from './open_app';
import { sleepFor } from './sleep_for';

export async function cleanGroup(
  device: DeviceWrapper,
  groupName: string,
  platform: SupportedPlatformsType,
  admin?: boolean
) {
  // Need to delete newly created group so that it doesn't confuse future tests
  const group = await device.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: groupName,
    maxWait: 5000,
  });
  if (!group) {
    console.log('Group not found, nothing to clean up');
    return;
  }
  while (group) {
    await sleepFor(1000);
    await device.onIOS().swipeLeft('Conversation list item', groupName);
    await device.onAndroid().longPressConversation(groupName);
    if (admin) {
      await device.clickOnElementAll({ strategy: 'accessibility id', selector: 'Leave' });
      await device.checkModalStrings(
        englishStripped('groupLeave').toString(),
        englishStripped('groupLeaveDescriptionAdmin')
          .withArgs({ group_name: groupName })
          .toString(),
        true
      );
      await device.clickOnElementAll(new LeaveGroupConfirm(device));
    } else {
      await device
        .onAndroid()
        .clickOnElementAll({ strategy: 'accessibility id', selector: 'Leave' });
      await device.onIOS().clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });
      if (platform === 'ios') {
        await device.checkModalStrings(
          englishStripped('groupDelete').toString(),
          englishStripped('groupDeleteDescription').withArgs({ group_name: groupName }).toString()
        );

        await device.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });
      } else {
        await device.checkModalStrings(
          englishStripped('groupLeave').toString(),
          englishStripped('groupLeaveDescription').withArgs({ group_name: groupName }).toString(),
          true
        );

        await device.clickOnElementAll(new LeaveGroupConfirm(device));
      }
    }
    const groupExistsStill = await device.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: groupName,
      maxWait: 5000,
    });
    if (!groupExistsStill) {
      console.log(`Group ${groupName} deleted successfully`);
      break;
    }
  }
  console.log('Finish cleaning up group: ', groupName);
}
