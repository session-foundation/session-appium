import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { CommunityInput, JoinCommunityButton } from '../locators';
import { ConversationHeaderName, EmptyConversation } from '../locators/conversation';
import { PlusButton } from '../locators/home';
import { JoinCommunityOption } from '../locators/start_conversation';

export const joinCommunity = async (
  device: DeviceWrapper,
  communityLink: string,
  communityName: string
) => {
  await device.clickOnElementAll(new PlusButton(device));
  await device.clickOnElementAll(new JoinCommunityOption(device));
  await device.inputText(communityLink, new CommunityInput(device));
  await device.clickOnElementAll(new JoinCommunityButton(device));
  // iOS lets us limit the number of community messages 
  // so checking the messages are there (empty state disappeared) is not an issue
  await device.onAndroid().hasElementBeenDeleted(new EmptyConversation(device)); 
  await device.waitForTextElementToBePresent(new ConversationHeaderName(device, communityName));
};
