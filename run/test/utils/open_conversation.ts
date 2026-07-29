import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ConversationHeaderName } from '../locators/conversation';
import { ConversationItem } from '../locators/home';

/**
 * Opens a conversation from the home screen and confirms we landed in it.
 *
 * Tapping a row is not as safe as it looks. The tap goes via an element handle, but an XCUITest
 * handle is a path into the hierarchy, so when the list re-orders between resolving the row and
 * clicking it, the handle can resolve onto a different row — silently, without a stale-element
 * error. Nothing downstream notices: the test carries on against the wrong conversation and fails
 * later, wherever the first missing element happens to be, with an error that says nothing about
 * how it got there.
 *
 * Checking the header makes that fail immediately, at the point it happened, saying what happened.
 */
export async function openConversation(device: DeviceWrapper, conversationName: string) {
  await device.clickOnElementAll(new ConversationItem(device, conversationName));
  await device.waitForTextElementToBePresent(new ConversationHeaderName(device, conversationName));
}
