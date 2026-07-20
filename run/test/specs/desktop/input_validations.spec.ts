// @ported-from tests/automation/input_validations.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { Global, Onboarding } from '../../../desktop/locators';
import { sessionTestOneWindow } from '../../../desktop/sessionTest';
import { grabTextFromElement } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

[
  {
    testName: 'Incorrect seed',
    // the word 'zork' is not on the mnemonic word list which triggers the expected error
    incorrectSeed: 'ruby bakery illness push rift reef nabbing bawled hope zork silk lobster hope',
    expectedError: tStripped('recoveryPasswordErrorMessageIncorrect'),
  },
  {
    testName: 'Too short seed',
    incorrectSeed: 'zork',
    expectedError: tStripped('recoveryPasswordErrorMessageShort'),
  },
  {
    testName: 'Wrong seed',
    // the seed phrase is too long but contains only valid mnemonics which triggers the generic error
    incorrectSeed:
      'ruby bakery illness push rift reef nabbing bawled hope ruby silk lobster hope ruby ruby ruby',
    expectedError: tStripped('recoveryPasswordErrorMessageGeneric'),
  },
].forEach(({ testName, incorrectSeed, expectedError }) => {
  sessionTestOneWindow(`Seed validation: "${testName}"`, async ([window]) => {
    await window.clickOn(Onboarding.iHaveAnAccountButton);
    await window.pasteIntoInput('recovery-phrase-input', incorrectSeed);
    await window.clickOn(Global.continueButton);
    await window.waitForTestIdWithText('error-message');
    const actualError = await grabTextFromElement(window.getPage(), 'data-testid', 'error-message');
    if (actualError !== expectedError) {
      throw new Error(`Expected error message: ${expectedError}, but got: ${actualError}`);
    }
  });
});

[
  {
    testName: 'No name',
    // This currently fails - displays wrong error message
    displayName: ' ',
    expectedError: tStripped('displayNameErrorDescription'),
  },
  {
    testName: 'Too long name',
    displayName:
      'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed int',
    expectedError: tStripped('displayNameErrorDescriptionShorter'),
  },
].forEach(({ testName, displayName, expectedError }) => {
  sessionTestOneWindow(`Display name validation: "${testName}"`, async ([window]) => {
    await window.clickOn(Onboarding.createAccountButton);
    await window.pasteIntoInput('display-name-input', displayName);
    await window.clickOn(Global.continueButton);
    await window.waitForTestIdWithText(Global.errorMessage.selector);
    const actualError = await grabTextFromElement(
      window.getPage(),
      'data-testid',
      Global.errorMessage.selector
    );
    if (testName === 'No name') {
      console.log('Expected failure: see SES-2832');
    }
    if (actualError !== expectedError) {
      throw new Error(`Expected error message: ${expectedError}, but got: ${actualError}`);
    }
  });
});
