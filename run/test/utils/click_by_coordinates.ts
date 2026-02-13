import { DeviceWrapper } from '../../types/DeviceWrapper';
import { Coordinates } from '../../types/testing';
import { sleepFor } from './sleep_for';

export const clickOnCoordinates = async (device: DeviceWrapper, coordinates: Coordinates) => {
  const { x, y } = coordinates;
  await sleepFor(1000);
  await device.pressCoordinates(x, y);
  device.log(`Tapped coordinates ${x}, ${y}`);
};
