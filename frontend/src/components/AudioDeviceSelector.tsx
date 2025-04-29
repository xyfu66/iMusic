import React from 'react';
import { AudioDeviceIF } from '../utils/interfaces';

interface AudioDeviceSelectorProps {
  audioDevices: AudioDeviceIF[];
  selectedAudioDevice: number;
  setSelectedAudioDevice: (deviceIndex: number) => void;
}

const AudioDeviceSelector: React.FC<AudioDeviceSelectorProps> = ({
  audioDevices,
  selectedAudioDevice,
  setSelectedAudioDevice,
}) => {
  return (
    <div>
      <select
        value={selectedAudioDevice}
        onChange={(e) => setSelectedAudioDevice(Number(e.target.value))}
        className="w-full px-4 py-2 rounded-md bg-white border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
      >
        {audioDevices.map((device, index) => (
          <option key={index} value={device.index}>
            {device.name || `Audio Device ${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AudioDeviceSelector; 