import { registerPlugin } from '@capacitor/core';

export interface DeviceServicePlugin {
  startService(): Promise<void>;
  stopService(): Promise<void>;
}

const DeviceService = registerPlugin<DeviceServicePlugin>('DeviceService');

export default DeviceService; 