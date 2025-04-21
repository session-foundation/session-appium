import { englishStripped } from '../../localizer/Localizer';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EditGroup } from './locators';
import { ConversationSettings, MessageInput } from './locators/conversation';
import {
  ConfirmRemovalButton,
  GroupMember,
  MemberStatus,
  RemoveMemberButton,
} from './locators/groups';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

iosIt('Kick member', 'medium', kickMember);
androidIt('Kick member', 'medium', kickMember);

async function kickMember(platform: SupportedPlatformsType) {
  const testGroupName = 'Kick member';

  const {
    devices: { device1, device2, device3 },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await device1.clickOnElementAll(new EditGroup(device1));
  await device1.clickOnElementAll({ ...new GroupMember(device1).build(USERNAME.BOB) });
  await device1.clickOnElementAll(new RemoveMemberButton(device1));
  await device1.checkModalStrings(
    englishStripped('remove').toString(),
    englishStripped('groupRemoveDescription')
      .withArgs({ name: USERNAME.BOB, group_name: testGroupName })
      .toString()
  );
  await device1.clickOnElementAll(new ConfirmRemovalButton(device1));
  await device1.waitForTextElementToBePresent(new MemberStatus(device1).build('Pending removal'));
  await device1.hasElementBeenDeleted({
    ...new GroupMember(device1).build(USERNAME.BOB),
    maxWait: 10000,
  });
  await device1.navigateBack(true);
  await device1.onIOS().navigateBack();
  await Promise.all([
    device1.waitForControlMessageToBePresent(
      englishStripped('groupRemoved').withArgs({ name: USERNAME.BOB }).toString()
    ),
    device3.waitForControlMessageToBePresent(
      englishStripped('groupRemoved').withArgs({ name: USERNAME.BOB }).toString()
    ),
  ]);
  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Empty list',
    text: englishStripped('groupRemovedYou').withArgs({ group_name: testGroupName }).toString(),
  });
  await device2.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Empty list',
  });
  //   Does message input exist? Is conversation settings visible?
  await device2.doesElementExist({ ...new MessageInput(device2).build(), maxWait: 1000 });
  await device2.doesElementExist({ ...new ConversationSettings(device2).build(), maxWait: 1000 });
}
