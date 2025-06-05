import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  DownloadMediaButton,
  ImageName,
  MediaMessageInput,
  SendMediaButton,
  ShareExtensionIcon,
} from './locators';
import { PhotoLibrary } from './locators/external';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { matchAndTapImage } from './utils/matchAndTapImage';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Share to session',
  risk: 'low',
  testCb: shareToSession,
  countOfDevicesNeeded: 2,
});

async function shareToSession(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const testMessage = 'Testing sharing an image through photo gallery to Session';
  const fileName = 'test_image.jpg';
  const fileNameThumbnail = 'test_image_thumbnail.png';

  // Need to make sure contact is confirm before moving away from Session
  await sleepFor(1000);
  await alice1.pressHome();
  await sleepFor(2000);
  await alice1.pushMediaToDevice(fileName);
  //  Photo app is on different page than Session
  await alice1.onIOS().swipeRightAny('Session');
  await alice1.clickOnElementAll(new PhotoLibrary(alice1));
  await sleepFor(2000);
  await alice1.onIOS().clickOnByAccessibilityID('Select');
  await matchAndTapImage(
    alice1.onIOS(),
    { strategy: 'xpath', selector: '//XCUIElementTypeImage' },
    fileNameThumbnail
  );
  await alice1.onAndroid().clickOnElementAll(new ImageName(alice1));
  await alice1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Share' });
  await alice1.clickOnElementAll(new ShareExtensionIcon(alice1));
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: USERNAME.BOB,
  });
  await alice1.inputText(testMessage, new MediaMessageInput(alice1));
  await alice1.clickOnElementAll(new SendMediaButton(alice1));
  // Loading screen...
  await alice1.waitForLoadingOnboarding();
  //   Check Bob's device
  //   TODO replace with TrustUser function when Groups are merged
  await bob1.clickOnByAccessibilityID('Untrusted attachment message');
  await sleepFor(500);
  // User B - Click on 'download'
  await bob1.clickOnElementAll(new DownloadMediaButton(bob1));
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
}
