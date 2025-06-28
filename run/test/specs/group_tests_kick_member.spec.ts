import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EditGroup } from './locators';
import { ConversationSettings, MessageInput } from './locators/conversation';
import {
  ConfirmRemovalButton,
  GroupMember,
  MemberStatus,
  RemoveMemberButton,
} from './locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';
import type { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Kick member',
  risk: 'medium',
  testCb: kickMember,
  countOfDevicesNeeded: 3,
});

async function kickMember(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Kick member';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new EditGroup(alice1));
  await alice1.clickOnElementAll({ ...new GroupMember(alice1).build(USERNAME.BOB) });
  await alice1.clickOnElementAll(new RemoveMemberButton(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('remove').toString(),
    englishStrippedStr('groupRemoveDescription')
      .withArgs({ name: USERNAME.BOB, group_name: testGroupName })
      .toString()
  );
  await alice1.clickOnElementAll(new ConfirmRemovalButton(alice1));
  await alice1.waitForTextElementToBePresent(new MemberStatus(alice1).build('Pending removal'));
  await alice1.hasElementBeenDeleted({
    ...new GroupMember(alice1).build(USERNAME.BOB),
    maxWait: 10000,
  });
  await alice1.navigateBack(true);
  await alice1.onIOS().navigateBack();
  await Promise.all([
    alice1.waitForControlMessageToBePresent(
      englishStrippedStr('groupRemoved').withArgs({ name: USERNAME.BOB }).toString()
    ),
    charlie1.waitForControlMessageToBePresent(
      englishStrippedStr('groupRemoved').withArgs({ name: USERNAME.BOB }).toString()
    ),
  ]);
  await bob1.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Empty list',
    text: englishStrippedStr('groupRemovedYou').withArgs({ group_name: testGroupName }).toString(),
  });
  await bob1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Empty list',
  });
  //   Does message input exist? Is conversation settings visible?
  await bob1.doesElementExist({ ...new MessageInput(bob1).build(), maxWait: 1000 });
  await bob1.doesElementExist({ ...new ConversationSettings(bob1).build(), maxWait: 1000 });
}
