import type { CTAType } from './cta';
import type { IBaseDeviceWrapper } from './IBaseDeviceWrapper';

/**
 * Mobile (Appium) capability surface. Extends the cross-platform base with the
 * mobile-only high-level members, including the CTA/modal helpers (whose desktop
 * equivalents have different shapes) and the "Pro Activated" settings assertion
 * (which has no desktop equivalent yet).
 *
 * The full low-level Appium primitive surface (element finders, coordinate
 * clicks, adb/simctl helpers, …) still lives directly on the `DeviceWrapper`
 * class; this interface captures the mobile-specific members with
 * platform-appropriate signatures and can be expanded as more code is typed
 * against the interface rather than the concrete class.
 */
export interface IMobileWrapper extends IBaseDeviceWrapper {
  isIOS(): boolean;
  isAndroid(): boolean;
  onIOS(): IMobileWrapper;
  onAndroid(): IMobileWrapper;
  tap(xCoOrdinates: number, yCoOrdinates: number): Promise<void>;
  pressHome(): Promise<void>;
  getPageSource(): Promise<string>;

  // CTA / modal (Appium-shaped; desktop uses a different mechanism)
  checkCTA(type: CTAType): Promise<void>;
  verifyNoCTAShows(): Promise<void>;
  dismissCTA(): Promise<void>;
  checkModalStrings(expectedHeading: string, expectedDescription: string): Promise<void>;

  // Session Pro (mobile-only for now — desktop has no "Pro Activated" surface yet)
  assertProActive(): Promise<void>;
}
