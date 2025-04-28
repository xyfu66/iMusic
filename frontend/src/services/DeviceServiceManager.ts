import DeviceService from '../plugins/DeviceService';

class DeviceServiceManager {
    private static instance: DeviceServiceManager;
    private isRunning: boolean = false;

    private constructor() {}

    public static getInstance(): DeviceServiceManager {
        if (!DeviceServiceManager.instance) {
            DeviceServiceManager.instance = new DeviceServiceManager();
        }
        return DeviceServiceManager.instance;
    }

    public async startService(): Promise<void> {
        if (this.isRunning) {
            console.log('Device service is already running');
            return;
        }

        try {
            await DeviceService.startDeviceService();
            this.isRunning = true;
            console.log('Device service started successfully');
        } catch (error) {
            console.error('Failed to start device service:', error);
            throw error;
        }
    }

    public async stopService(): Promise<void> {
        if (!this.isRunning) {
            console.log('Device service is not running');
            return;
        }

        try {
            await DeviceService.stopDeviceService();
            this.isRunning = false;
            console.log('Device service stopped successfully');
        } catch (error) {
            console.error('Failed to stop device service:', error);
            throw error;
        }
    }

    public isServiceRunning(): boolean {
        return this.isRunning;
    }
}

export default DeviceServiceManager; 