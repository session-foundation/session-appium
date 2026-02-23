import { DeviceWrapper } from '../../types/DeviceWrapper';
import { Coordinates } from '../../types/testing';

export const clickOnCoordinates = async (device: DeviceWrapper, coordinates: Coordinates) => {
  const { x, y } = coordinates;
  await device.pressCoordinates(x, y);
  device.log(`Tapped coordinates ${x}, ${y}`);
};
