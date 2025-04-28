import { registerPlugin } from '@capacitor/core';

export interface DeviceServicePlugin {
  startDeviceService(): Promise<void>;
  stopDeviceService(): Promise<void>;
}

const DeviceService = registerPlugin<DeviceServicePlugin>('DeviceService');

export default DeviceService; 