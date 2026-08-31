import { DeviceWrapper } from '../../types/DeviceWrapper';
import {
  ChromeNotificationsNegativeButton,
  ChromeUseWithoutAnAccount,
  SafariAddressBar,
  URLInputField,
} from '../locators/browsers';
import { iOSPhotosContinuebutton } from '../locators/external';

/**
 * Dismiss Chrome's first-run screens, if this is the first run.
 *
 * First open triggers an account check and a notifications modal. If the account check appears,
 * notifications follow after dismissing it, which is not detectable upfront; if someone already
 * pressed "Use without an account", only the notifications prompt appears.
 *
 * Whether the first run is happening is decided by waiting for the address bar and the first-run
 * screens TOGETHER, and acting on whichever arrives. It cannot be decided by a short absence: on a
 * cold Chrome start nothing has rendered yet, so probing for the first-run screens alone reports
 * absent for a screen that is about to appear, and the caller then waits out its whole timeout
 * against a first-run screen it was told was not there. The address bar is what makes the negative
 * case positive evidence — Chrome is up and past its first run — rather than an absence.
 *
 * The first run is once per emulator, so this is a no-op on all but one spec per pool, and which
 * spec that is depends on scheduling.
 *
 * The default has to cover a COLD Chrome start on a loaded host, which is the situation this exists
 * for: measured over 30s with four workers running. Because this throws rather than returning, the
 * budget also has to cover what the caller's own wait used to absorb.
 */
export async function handleChromeFirstTimeOpen(device: DeviceWrapper, maxWait: number = 90_000) {
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const [useWithoutAccount, notifications, addressBar] = await Promise.all([
      device.doesElementExist({ ...new ChromeUseWithoutAnAccount(device).build(), maxWait: 1_000 }),
      device.doesElementExist({
        ...new ChromeNotificationsNegativeButton(device).build(),
        maxWait: 1_000,
      }),
      device.doesElementExist({ ...new URLInputField(device).build(), maxWait: 1_000 }),
    ]);

    if (useWithoutAccount) {
      device.log('Chrome has been opened for the first time, dismissing the account screen');
      await device.clickOnElementAll(new ChromeUseWithoutAnAccount(device));
      continue;
    }

    if (notifications) {
      device.log('Dismissing Chrome notifications prompt');
      await device.clickOnElementAll(new ChromeNotificationsNegativeButton(device));
      continue;
    }

    if (addressBar) {
      device.log('Chrome is past its first run, proceeding');
      return;
    }
  }

  // Out of time with neither outcome seen. Say so rather than returning quietly: the caller's own wait
  // would otherwise report a missing address bar, which is the symptom and not the cause.
  throw new Error(
    `Chrome showed neither its address bar nor a first-run screen within ${maxWait}ms`
  );
}

export async function handlePhotosFirstTimeOpen(device: DeviceWrapper) {
  // On iOS there's a "What's New" screen that appears the first time Photos app is opened
  if (device.isIOS()) {
    const continueButton = await device.doesElementExist({
      ...new iOSPhotosContinuebutton(device).build(),
      maxWait: 5_000,
    });
    if (!continueButton) {
      device.log(`Photos app opened without a "What's New" screen, proceeding`);
    } else {
      device.log(`Photos app has been opened for the first time, dismissing modals`);
      await device.clickOnElementAll(new iOSPhotosContinuebutton(device));
      await device.clickOnByAccessibilityID('Don’t Allow');
    }
  }
  // On Android, the Photos app shows a sign-in prompt the first time it's opened that needs to be dismissed
  // I've seen two different kinds of sign in buttons on the same set of emulators
  if (device.isAndroid()) {
    let signInButton = await device.doesElementExist({
      strategy: 'id',
      selector: 'com.google.android.apps.photos:id/sign_in_button',
      maxWait: 1_000,
    });

    if (!signInButton) {
      signInButton = await device.doesElementExist({
        strategy: '-android uiautomator',
        selector: 'new UiSelector().text("Sign in")',
        maxWait: 1_000,
      });
    }
    if (!signInButton) {
      device.log(`Photos app opened without a sign-in prompt, proceeding`);
    } else {
      device.log(`Photos app has been opened for the first time, dismissing sign-in prompt`);
      await device.clickOnCoordinates(550, 500); // Tap outside of the sign-in modal to dismiss
    }
  }
}

/**
 * Bring the browser's URL field on screen and return it.
 *
 * The two browsers need opposite handling. Chrome can raise first-open modals that have to be dismissed
 * before anything is readable. Safari raises nothing, but collapses the address bar to the domain alone
 * (`TabBarItemTitle`) and expands the full `URL` field only once tapped.
 *
 * That tap is retried rather than waited on. A tap landing while Safari is still coming up is swallowed —
 * the element is present and tappable before it will act on it — and the field then never appears, which
 * surfaces as `URL` not found several lines later rather than as a missed tap. There is no state that
 * distinguishes "not ready" from "ready", and a second tap on an already-expanded bar is harmless.
 */
export async function getBrowserUrlField(device: DeviceWrapper) {
  if (!device.isIOS()) {
    await handleChromeFirstTimeOpen(device);
    return device.waitForTextElementToBePresent(new URLInputField(device));
  }

  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await device.clickOnElementAll(new SafariAddressBar(device));
    const revealed = await device.doesElementExist({
      ...new URLInputField(device).build(),
      maxWait: 5_000,
    });
    if (revealed) {
      break;
    }
    device.log(`Safari address bar did not expand (attempt ${attempt}/${attempts}), tapping again`);
  }

  // Reached either expanded or out of attempts; the wait produces the failure so it reads like any
  // other missing element.
  return device.waitForTextElementToBePresent(new URLInputField(device));
}
