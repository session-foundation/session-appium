import { DeviceWrapper } from '../../types/DeviceWrapper';

// Returns the names of all conversation list items in their current DOM order
export const getConversationOrder = async (device: DeviceWrapper): Promise<string[]> => {
  const items = await device.findElementsByAccessibilityId('Conversation list item');
  return Promise.all(items.map(item => device.getTextFromElement(item)));
};

export { assertPinOrder } from '../../shared/conversation_order';
