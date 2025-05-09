import { BE_Url_Local } from '../utils/common'; 
import { Capacitor } from '@capacitor/core';
import { AudioDeviceIF } from '../utils/interfaces';

export const fetchAudioDevices = async (): Promise<{ devices: AudioDeviceIF[], error?: string }> => {
  try {
    console.log('Fetching audio devices...');
    console.log('Platform:', Capacitor.getPlatform());
    console.log('Backend URL:', BE_Url_Local);

    try {
      const response = await fetch(`${BE_Url_Local}/audio-devices`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Backend response:', data);
      
      if (!data.devices || data.devices.length === 0) {
        return {
          devices: [],
          error: '未检测到音频设备。请确保已连接麦克风或其他音频输入设备。'
        };
      }
      
      return {
        devices: data.devices
      };
    } catch (webError) {
      console.error('Web API error:', webError);
      return {
        devices: [],
        error: '无法连接到音频设备服务。请检查网络连接或重试。'
      };
    }
  } catch (error) {
    console.error('Error fetching audio devices:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return {
      devices: [],
      error: '获取音频设备时发生错误。请重试或联系支持。'
    };
  }
};