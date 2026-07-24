import { DeviceWrapper } from './DeviceWrapper';

/**
 * iOS-specific mobile client.
 *
 * Currently a thin subclass that inherits all behaviour from the shared
 * `DeviceWrapper` base. The interleaved `if (this.isIOS())` branches in the base
 * will be migrated into overrides here incrementally in later changes.
 */
export class IosDeviceWrapper extends DeviceWrapper {}
