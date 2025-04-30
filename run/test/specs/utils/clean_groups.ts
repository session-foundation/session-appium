import { englishStripped } from '../../../localizer/Localizer';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { StrategyExtractionObj } from '../../../types/testing';
import { LeaveGroupConfirm } from '../locators/groups';
import { sleepFor } from './sleep_for';

async function waitUntilGone(
  device: DeviceWrapper,
  args: { text: string; maxWait?: number } & StrategyExtractionObj,
  timeoutMs = 15000,
  pollInterval = 500
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const stillThere = await device.doesElementExist({
      ...args,
      maxWait: 1000,
    });
    if (!stillThere) {
      console.warn(`${args.selector} gone`);
      return;
    }
    await sleepFor(pollInterval);
  }
  throw new Error(
    `Element '${args.selector}' with text '${args.text}' still present after ${timeoutMs}ms`
  );
}

export async function cleanGroup(device: DeviceWrapper, groupName: string, admin?: boolean) {
  // Need to delete newly created group so that it doesn't confuse future tests
  while (true) {
    const group = await device.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: groupName,
      maxWait: 1000,
    });

    if (!group) {
      console.log('Group not found, nothing to clean up');
      return;
    }

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
      await device.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });

      await device.checkModalStrings(
        englishStripped('groupDelete').toString(),
        englishStripped('groupDeleteDescriptionMember')
          .withArgs({ group_name: groupName })
          .toString(),
        true
      );

      await device.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });
    }
    await waitUntilGone(
      device,
      { strategy: 'accessibility id', selector: 'Conversation list item', text: groupName },
      10000,
      500
    );

    console.log('Finish cleaning up group: ', groupName);
  }
}
