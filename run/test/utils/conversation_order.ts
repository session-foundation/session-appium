import { DeviceWrapper } from '../../types/DeviceWrapper';
import { verify } from './utilities';

// Returns the names of all conversation list items in their current DOM order
export const getConversationOrder = async (device: DeviceWrapper): Promise<string[]> => {
  const items = await device.findElementsByAccessibilityId('Conversation list item');
  return Promise.all(items.map(item => device.getTextFromElement(item)));
};

// Asserts pinned conversations float to the top maintaining relative order, followed by unpinned in their original order.
// Pass an empty pinnedNames array to assert the order is fully restored (e.g. after unpinning).
export const assertPinOrder = (
  beforeOrder: string[],
  pinnedNames: string[],
  afterOrder: string[]
) => {
  const pinnedSet = new Set(pinnedNames);
  const pinnedExpected: string[] = [];
  const unpinnedExpected: string[] = [];
  for (const name of beforeOrder) {
    if (pinnedSet.has(name)) {
      pinnedExpected.push(name);
    } else {
      unpinnedExpected.push(name);
    }
  }
  const expected = [...pinnedExpected, ...unpinnedExpected];

  verify(afterOrder, 'Conversation order is not correct').toEqual(expected);
};
