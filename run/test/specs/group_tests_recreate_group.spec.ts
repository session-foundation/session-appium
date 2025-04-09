import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME, User } from '../../types/testing';
import { ContinueButton } from './locators/global';
import {
  CreateGroupButton,
  GroupNameInput,
  LegacyGroupBanner,
  RecreateGroupButton,
} from './locators/groups';
import { sleepFor } from './utils';
import { cleanGroup } from './utils/clean_groups';
import { sortByPubkey } from './utils/get_account_id';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';
import { restoreAccount } from './utils/restore_account';

bothPlatformsIt('Recreate group', 'high', recreateGroup);

const userA: User = {
  userName: USERNAME.ALICE,
  accountID: '0547866fc33d9486a09758e671d451ddb8b380c7c854f63210bd2d8f22fa741947',
  recoveryPhrase:
    'sighting lava pockets nerves wounded nanny getting gulp goldfish insult nagged pairing insult',
};
const userB: User = {
  userName: USERNAME.BOB,
  accountID: '05b5265c457da3728c43825845f634311ddb6afe04b677670ae9ffb5cfc29a9d52',
  recoveryPhrase:
    'earth haunted enjoy hazard upload upload square liar wildly ferry succeed isolated hazard',
};
const userC: User = {
  userName: USERNAME.CHARLIE,
  accountID: '05afe033f64546886ad900828b9284766169f0ee6590e74213f6d6fe19854d2c42',
  recoveryPhrase:
    'upright byline ointment lamb mayor midst utensils whipped violin cottage junk bikini cottage',
};

async function recreateGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Legacy group';
  const newGroupName = 'Recreated group';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  await Promise.all([
    restoreAccount(device1, userA),
    restoreAccount(device2, userB),
    restoreAccount(device3, userC),
  ]);
  // Need to check if the group is already recreated and delete it
  // Admin needs to leave group first for the other users to have 'Delete' option
  await cleanGroup(device1, newGroupName, platform, true);
  await Promise.all([
    cleanGroup(device2, newGroupName, platform),
    cleanGroup(device3, newGroupName, platform),
  ]);
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.clickOnElementAll({
        strategy: 'accessibility id',
        selector: 'Conversation list item',
        text: testGroupName,
      })
    )
  );
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForTextElementToBePresent(new LegacyGroupBanner(device))
    )
  );
  await device1.clickOnElementAll(new RecreateGroupButton(device1));
  await device1.checkModalStrings(
    englishStripped('recreateGroup').toString(),
    englishStripped('legacyGroupChatHistory').toString()
  );
  await device1.clickOnElementAll(new ContinueButton(device1));
  // Change group name so you know it's the new group
  await device1.deleteText(new GroupNameInput(device1));
  await device1.inputText(newGroupName, new GroupNameInput(device1));
  // Need to blind click on iOS to dismiss keyboard
  await device1.onIOS().clickOnCoordinates(100, 460);
  await sleepFor(500);
  await device1.clickOnElementAll(new CreateGroupButton(device1));
  await device1.waitForLoadingOnboarding();
  await Promise.all([await device2.navigateBack(), await device3.navigateBack()]);
  await Promise.all(
    [device2, device3].map(device =>
      device.clickOnElementAll({
        strategy: 'accessibility id',
        selector: 'Conversation list item',
        text: newGroupName,
      })
    )
  );
  const [firstUser, secondUser] = sortByPubkey(userB, userC);
  await Promise.all([
    device1
      .onIOS()
      .waitForControlMessageToBePresent(
        englishStripped(`groupMemberNewTwo`)
          .withArgs({ name: firstUser, other_name: secondUser })
          .toString()
      ),
    device2.waitForControlMessageToBePresent(
      englishStripped('groupInviteYouAndOtherNew')
        .withArgs({ other_name: userC.userName })
        .toString()
    ),
    device3.waitForControlMessageToBePresent(
      englishStripped('groupInviteYouAndOtherNew')
        .withArgs({ other_name: userB.userName })
        .toString()
    ),
  ]);

  await closeApp(device1, device2, device3);
}
