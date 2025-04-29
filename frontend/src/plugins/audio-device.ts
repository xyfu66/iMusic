import { registerPlugin } from '@capacitor/core';
import { AudioDeviceIF } from '../utils/interfaces';

export interface AudioDevicePlugin {
  getAudioInputDevices(): Promise<{ devices: AudioDeviceIF[] }>;
}

const AudioDevice = registerPlugin<AudioDevicePlugin>('AudioDevice');

export default AudioDevice; 