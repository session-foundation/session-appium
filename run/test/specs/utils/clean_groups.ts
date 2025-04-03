import { englishStripped } from '../../../localizer/i18n/localizedString';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { ConversationSettings } from '../locators/conversation';
import { LeaveGroupButton, LeaveGroupConfirm } from '../locators/groups';
import { SupportedPlatformsType } from './open_app';

export async function cleanGroups(
  device1: DeviceWrapper,
  device2: DeviceWrapper,
  device3: DeviceWrapper,
  groupName: string,
  platform: SupportedPlatformsType
) {
  // Need to delete newly created group so that it doesn't confuse future tests
  const [group, group2, group3] = await Promise.all(
    [device1, device2, device3].map(device =>
      device.doesElementExist({
        strategy: 'accessibility id',
        selector: 'Conversation list item',
        text: groupName,
        maxWait: 5000,
      })
    )
  );
  if (group || group2 || group3) {
    // await Promise.all(
    //   [device1, device2, device3].map(device =>
    //     device.clickOnElementAll({
    //       strategy: 'accessibility id',
    //       selector: 'Conversation list item',
    //       text: groupName,
    //     })
    //   )
    // );
    await device1.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: groupName,
    });
    // await Promise.all(
    //   [device1, device2, device3].map(device =>
    //     device.clickOnElementAll(new ConversationSettings(device))
    //   )
    // );
    await device1.clickOnElementAll(new ConversationSettings(device1));
    await device1.clickOnElementAll(new LeaveGroupButton(device1));
    await device1.checkModalStrings(
      englishStripped('groupLeave').toString(),
      englishStripped('groupLeaveDescriptionAdmin').withArgs({ group_name: groupName }).toString(),
      true
    );
    await device1.clickOnElementAll(new LeaveGroupConfirm(device1));
    await Promise.all(
      [device2, device3].map(device =>
        device.onIOS().swipeLeft('Conversation list item', groupName)
      )
    );
    await Promise.all(
      [device2, device3].map(device => device.onAndroid().longPressConversation(groupName))
    );
    await Promise.all(
      [device2, device3].map(device =>
        device.onAndroid().clickOnElementAll({ strategy: 'accessibility id', selector: 'Leave' })
      )
    );
    if (platform === 'ios') {
      await Promise.all(
        [device2, device3].map(device =>
          device.checkModalStrings(
            englishStripped('groupDelete').toString(),
            englishStripped('groupDeleteDescription').withArgs({ group_name: groupName }).toString()
          )
        )
      );
      await Promise.all(
        [device2, device3].map(device =>
          device.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' })
        )
      );
    } else {
      await Promise.all(
        [device2, device3].map(device =>
          device.checkModalStrings(
            englishStripped('groupLeave').toString(),
            englishStripped('groupLeaveDescription').withArgs({ group_name: groupName }).toString(),
            true
          )
        )
      );
      await Promise.all(
        [device2, device3].map(device => device.clickOnElementAll(new LeaveGroupConfirm(device)))
      );
    }
    await Promise.all(
      [device1, device2, device3].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Conversation list item',
          text: groupName,
          maxWait: 5000,
        })
      )
    );
  }
}
