import { Page } from '@playwright/test';

import { tStripped } from '../localizer/lib';
import { isChecked } from './checked';
import { Conversation, ConversationSettings, Global } from './locators';
import { ConversationType, DataTestId, DisappearOptions } from './types';
import {
  checkModalStrings,
  clickOn,
  clickOnElement,
  clickOnMatchingText,
  formatTimeOption,
  waitForElement,
} from './utils';

export const setDisappearingMessages = async (
  windowA: Page,
  [conversationType, timerType, timerDuration, disappearAction]: DisappearOptions,
  windowB?: Page
) => {
  const enforcedType: ConversationType = conversationType;
  await clickOn(windowA, Conversation.conversationSettingsIcon, {
    maxWait: 5_000,
  });
  await clickOnElement({
    window: windowA,
    strategy: 'data-testid',
    selector: ConversationSettings.disappearingMessagesOption.selector,
    maxWait: 5_000,
  });

  if (enforcedType === '1:1') {
    await clickOnElement({
      window: windowA,
      strategy: 'data-testid',
      selector: timerType,
    });
    // Check that 1 Day default is automatically selected (default time is only relevant to 1:1's)
    let defaultTime;
    if (timerType === 'disappear-after-read-option') {
      // making explicit DataTestId here as `waitForElement` currently allows a string
      const dataTestId: DataTestId = 'input-time-option-12-hours';
      defaultTime = await waitForElement({
        window: windowA,
        locator: {
          strategy: 'data-testid',
          selector: dataTestId,
        },
        options: {
          maxWaitMs: 1_000,
          shouldLog: true,
        },
      });
    } else {
      // making explicit DataTestId here as `waitForElement` currently allows a string
      const dataTestId: DataTestId = 'input-time-option-1-days';

      defaultTime = await waitForElement({
        window: windowA,
        locator: {
          strategy: 'data-testid',
          selector: dataTestId,
        },
        options: {
          maxWaitMs: 1_000,
          shouldLog: true,
        },
      });
    }
    const checked = await isChecked(defaultTime);
    if (checked) {
      console.info('Timer default time is correct');
    } else {
      throw new Error('Default timer not set correctly');
    }
  }

  // Change timer to testing duration (10 seconds)
  await clickOnElement({
    window: windowA,
    strategy: 'data-testid',
    selector: timerDuration,
  });
  await clickOnElement({
    window: windowA,
    strategy: 'data-testid',
    selector: 'disappear-set-button',
  });
  await clickOnElement({
    window: windowA,
    strategy: 'data-testid',
    selector: 'modal-close-button',
  });
  await waitForElement({
    window: windowA,
    locator: Conversation.DisappearMessagesTypeAndTime,
  });
  if (windowB) {
    await clickOnMatchingText(windowB, tStripped('disappearingMessagesFollowSetting'));

    let action;
    if (disappearAction === 'read') {
      action = tStripped('disappearingMessagesTypeRead');
    } else {
      action = tStripped('disappearingMessagesTypeSent');
    }

    const formattedTime = formatTimeOption(timerDuration);

    const modalDescription = tStripped('disappearingMessagesFollowSettingOn', {
      time: formattedTime,
      disappearing_messages_type: action,
    });

    await checkModalStrings(
      windowB,
      tStripped('disappearingMessagesFollowSetting'),
      modalDescription
    );

    await clickOn(windowB, Global.confirmButton);
    await waitForElement({
      window: windowB,
      locator: Conversation.DisappearMessagesTypeAndTime,
    });
  }
};
