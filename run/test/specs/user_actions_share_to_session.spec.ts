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
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Share to session', 'low', shareToSession);

async function shareToSession(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testMessage = 'Testing sharing an image through photo gallery to Session}';
  const fileName = 'test_image.jpg';
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await device1.pressHome();
  await sleepFor(2000);
  //  Photo app is on different page than Session
  await device1.onIOS().swipeRightAny('Session');
  await device1.clickOnElementAll(new PhotoLibrary(device1));
  await sleepFor(2000);
  const testImage = await device1.doesElementExist(new ImageName(device1));
  if (!testImage) {
    await device1.pushMediaToDevice(platform, fileName);
  }
  await device1.clickOnElementAll(new ImageName(device1));
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Share' });
  await device1.clickOnElementAll(new ShareExtensionIcon(device1));
  //TODO Change this - This is a temporary ID until iOS implement 'Contact' accessibility ID
  await device1.onIOS().clickOnElementAll({ strategy: 'accessibility id', selector: USERNAME.BOB });
  await device1
    .onAndroid()
    .clickOnElementAll({ strategy: 'accessibility id', selector: 'Contact', text: USERNAME.BOB });
  await device1.inputText(testMessage, new MediaMessageInput(device1));
  await device1.clickOnElementAll(new SendMediaButton(device1));
  // Loading screen...
  await device1.waitForLoadingOnboarding();
  //   Check Bob's device
  //   TODO replace with TrustUser function when Groups are merged
  await device2.clickOnByAccessibilityID('Untrusted attachment message');
  await sleepFor(500);
  // User B - Click on 'download'
  await device2.clickOnElementAll(new DownloadMediaButton(device2));
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
}
