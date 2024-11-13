import { bothPlatformsIt } from "../../types/sessionIt";
import { CreateAccountButton, BackButton, DisplayNameInput, SlowModeRadio, ContinueButton, WarningModalQuitButton } from "./locators/onboarding";
import { SupportedPlatformsType } from "./utils/open_app";
import { openAppOnPlatformSingleDevice, closeApp } from "./utils/open_app";
import { USERNAME } from "../../types/testing";

bothPlatformsIt('Warning modal new account', 'medium', warningModalNewAccount)

async function warningModalNewAccount(platform: SupportedPlatformsType) {
    const { device } = await openAppOnPlatformSingleDevice(platform);
    await device.clickOnElementAll(new CreateAccountButton(device));
    await device.inputText(USERNAME.ALICE, new DisplayNameInput(device));
    await device.clickOnElementAll(new ContinueButton(device));
    // Checking that we're on the Message Notifications screen
    await device.doesElementExist(new SlowModeRadio(device));
    // Pressing Back on the Message Notifications screen 
    await device.clickOnElementAll(new BackButton(device));
    // Verifying that pressing Back from the Message Notifications screen does not bring up a modal but instead shows the Display Name input field
    await device.doesElementExist(new DisplayNameInput(device));
    await device.clickOnElementAll(new BackButton(device));
    await device.checkModalStrings(
        'warning', 
        'onboardingBackAccountCreation'
    )
    await device.clickOnElementAll(new WarningModalQuitButton(device));
    await closeApp(device);
}