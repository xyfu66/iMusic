import { BE_Url_Local } from '../utils/common'; 
import { Capacitor } from '@capacitor/core';
import AudioDevice from '../plugins/audio-device';
import { AudioDeviceIF } from '../utils/interfaces';

export const fetchAudioDevices = async (): Promise<AudioDeviceIF[]> => {
  try {
    console.log('Fetching audio devices...');
    console.log('Platform:', Capacitor.getPlatform());
    console.log('Backend URL:', BE_Url_Local);

    // 检查是否在安卓环境中运行
    if (Capacitor.getPlatform() === 'android') {
      console.log('Using Android native plugin to fetch audio devices');
      // 在安卓环境中，使用原生插件获取设备列表
      const { devices } = await AudioDevice.getAudioInputDevices();
      console.log('Android devices:', devices);
      
      // 转换设备格式
      return devices.map((device, index) => ({
        index,
        name: device.name || `Audio Device ${index + 1}`
      }));
    } else {
      console.log('Using backend API to fetch audio devices');
      // 在 Web 环境中，使用后端 API 获取设备列表
      const response = await fetch(`${BE_Url_Local}/audio-devices`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Backend response:', data);
      return data.devices || [];
    }
  } catch (error) {
    console.error('Error fetching audio devices:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return [];
  }
};