import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { CommunityInput, JoinCommunityButton } from '../locators';
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
  await device.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
    text: communityName,
  });
};
