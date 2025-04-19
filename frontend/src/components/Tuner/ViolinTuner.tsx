import React, { useState, useEffect } from 'react';

const violinTuningNotes = [
  { string: 'G', frequency: 196.0 }, // G3
  { string: 'D', frequency: 293.66 }, // D4
  { string: 'A', frequency: 440.0 }, // A4
  { string: 'E', frequency: 659.25 }, // E5
];

const ViolinTuner: React.FC = () => {
  const [currentFrequency, setCurrentFrequency] = useState<number | null>(null);
  const [selectedString, setSelectedString] = useState<string>('G');

  useEffect(() => {
    startPitchDetection();
    return () => stopPitchDetection();
  }, [selectedString]);

  const startPitchDetection = () => {
    console.log('Starting pitch detection for violin...');
    const interval = setInterval(() => {
      const targetFrequency = violinTuningNotes.find((note) => note.string === selectedString)?.frequency!;
      const simulatedFrequency = targetFrequency + (Math.random() * 10 - 5); // 模拟偏差
      setCurrentFrequency(simulatedFrequency);
    }, 500);
    return () => clearInterval(interval);
  };

  const stopPitchDetection = () => {
    console.log('Stopping pitch detection...');
    setCurrentFrequency(null);
  };

  const getFrequencyDeviation = () => {
    const targetFrequency = violinTuningNotes.find((note) => note.string === selectedString)?.frequency!;
    if (currentFrequency === null) return null;
    return (currentFrequency - targetFrequency).toFixed(2);
  };

  return (
    <div>
      <label className="block text-gray-700">选择琴弦:</label>
      <select
        value={selectedString}
        onChange={(e) => setSelectedString(e.target.value)}
        className="w-full px-4 py-2 rounded-md bg-white border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
      >
        {violinTuningNotes.map((note) => (
          <option key={note.string} value={note.string}>
            {note.string} - {note.frequency} Hz
          </option>
        ))}
      </select>

      <div className="mt-4 text-center">
        <p className="text-lg">当前音高: {currentFrequency ? `${currentFrequency.toFixed(2)} Hz` : '检测中...'}</p>
        <p className="text-lg">
          偏差: {getFrequencyDeviation() ? `${getFrequencyDeviation()} Hz` : '检测中...'}
        </p>
      </div>
    </div>
  );
};

export default ViolinTuner;