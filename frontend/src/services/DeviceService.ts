import { getDeviceBackendUrl } from '../utils/common'; 

const BE_Url_Local = getDeviceBackendUrl();

export interface AudioDevice {
  index: number;
  name: string;
}

export const fetchAudioDevices = async (): Promise<AudioDevice[]> => {
  try {
    const response = await fetch(`${BE_Url_Local}/audio-devices`); // 替换为实际的后端接口
    const data = await response.json();
    return data.devices || [];
  } catch (error) {
    console.error('Error fetching audio devices:', error);
    return [];
  }
};