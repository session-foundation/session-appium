import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';

export const saveSessionIdIos = async (device: DeviceWrapper) => {
  const selector = await device.grabTextFromAccessibilityId('Session ID generated');
  return selector;
};

export const getAccountId = async (device: DeviceWrapper) => {
  const AccountId = await device.grabTextFromAccessibilityId('Account ID');

  return AccountId;
};

export function sortByPubkey(...users: Array<User>) {
  return [...users]
    .sort((a, b) => a.accountID.localeCompare(b.accountID))
    .map(user => user.userName);
}
