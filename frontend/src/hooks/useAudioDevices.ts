import { useState, useEffect } from 'react';
import { fetchAudioDevices } from '../services/DeviceService'; // 确保路径正确
import { AudioDeviceIF } from '../utils/interfaces';

export const useAudioDevices = () => {
  const [audioDevices, setAudioDevices] = useState<AudioDeviceIF[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<number>(0);
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        const result = await fetchAudioDevices();
        
        if (result.error) {
          setError(result.error);
          setAudioDevices([]);
        } else {
          setAudioDevices(result.devices);
          if (result.devices.length > 0) {
            setSelectedAudioDevice(result.devices[0].index);
          }
        }
      } catch (err) {
        setError('加载音频设备时发生错误');
        setAudioDevices([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudioDevices();
  }, []);

  const refreshDevices = async () => {
    const result = await fetchAudioDevices();
    if (result.error) {
      setError(result.error);
      setAudioDevices([]);
    } else {
      setAudioDevices(result.devices);
      if (result.devices.length > 0) {
        setSelectedAudioDevice(result.devices[0].index);
      }
    }
  };

  return { 
    audioDevices, 
    selectedAudioDevice, 
    setSelectedAudioDevice,
    error,
    isLoading,
    refreshDevices
  };
};