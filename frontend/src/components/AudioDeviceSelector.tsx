import React from 'react';
import { AudioDeviceIF } from '../utils/interfaces';

interface AudioDeviceSelectorProps {
  audioDevices: AudioDeviceIF[];
  selectedAudioDevice: number;
  setSelectedAudioDevice: (deviceIndex: number) => void;
  error?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const AudioDeviceSelector: React.FC<AudioDeviceSelectorProps> = ({
  audioDevices,
  selectedAudioDevice,
  setSelectedAudioDevice,
  error,
  isLoading,
  onRefresh
}) => {
  if (isLoading) {
    return (
      <div className="w-full text-center py-2 text-gray-600">
        正在加载音频设备...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="text-red-500 mb-2">{error}</div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            重试
          </button>
        )}
      </div>
    );
  }

  if (audioDevices.length === 0) {
    return (
      <div className="w-full text-center py-2 text-gray-600">
        未检测到音频设备
      </div>
    );
  }

  return (
    <div>
      <select
        value={selectedAudioDevice}
        onChange={(e) => setSelectedAudioDevice(Number(e.target.value))}
        className="w-full px-4 py-2 rounded-md bg-white border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
      >
        {audioDevices.map((device, index) => (
          <option key={index} value={device.index}>
            {device.name || `音频设备 ${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AudioDeviceSelector; 