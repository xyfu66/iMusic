import { useState, useEffect } from 'react';
import { fetchAudioDevices, AudioDevice } from '../services/DeviceService'; // 确保路径正确

export const useAudioDevices = () => {
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<number>(0);

  useEffect(() => {
    const loadAudioDevices = async () => {
      const devices = await fetchAudioDevices();
      setAudioDevices(devices);
      if (devices.length > 0) {
        setSelectedAudioDevice(devices[0].index);
      }
    };

    loadAudioDevices();
  }, []);

  return { audioDevices, selectedAudioDevice, setSelectedAudioDevice };
};