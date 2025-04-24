import React, { useState, useEffect, useRef } from 'react';
import { BE_Url_Local } from '../../utils/common';

interface TuningNote {
  string: string;
  frequency: number;
  note: string;
}

const violinTuningNotes: TuningNote[] = [
  { string: 'G', frequency: 196.0, note: 'G3' },
  { string: 'D', frequency: 293.66, note: 'D4' },
  { string: 'A', frequency: 440.0, note: 'A4' },
  { string: 'E', frequency: 659.25, note: 'E5' },
];

const ViolinTuner: React.FC = () => {
  const [currentFrequency, setCurrentFrequency] = useState<number | null>(null);
  const [selectedString, setSelectedString] = useState<string>('G');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [deviation, setDeviation] = useState<number | null>(null);
  const [isInTune, setIsInTune] = useState<boolean | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startPitchDetection = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    // 连接到设备服务的 WebSocket
    const ws = new WebSocket(BE_Url_Local.replace(/^http/, 'ws') + '/ws/tuner/violin');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Violin tuner WebSocket connected');
      setIsListening(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.frequency) {
          setCurrentFrequency(data.frequency);
          const targetFrequency = violinTuningNotes.find(note => note.string === selectedString)?.frequency!;
          const currentDeviation = data.frequency - targetFrequency;
          setDeviation(currentDeviation);
          setIsInTune(Math.abs(currentDeviation) < 1); // 允许1Hz的误差
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
      setIsListening(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsListening(false);
    };
  };

  const stopPitchDetection = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ action: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsListening(false);
    setCurrentFrequency(null);
    setDeviation(null);
    setIsInTune(null);
  };

  const getDeviationColor = () => {
    if (deviation === null) return 'text-gray-500';
    if (Math.abs(deviation) < 1) return 'text-green-500';
    if (Math.abs(deviation) < 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getDeviationArrow = () => {
    if (deviation === null) return '';
    if (Math.abs(deviation) < 1) return '✓';
    return deviation > 0 ? '↑' : '↓';
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">选择琴弦:</label>
        <select
          value={selectedString}
          onChange={(e) => setSelectedString(e.target.value)}
          className="w-full px-4 py-2 rounded-md bg-white border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
          disabled={isListening}
        >
          {violinTuningNotes.map((note) => (
            <option key={note.string} value={note.string}>
              {note.string}弦 ({note.note} - {note.frequency} Hz)
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <button
          onClick={isListening ? stopPitchDetection : startPitchDetection}
          className={`w-full py-2 px-4 rounded-md text-white font-bold ${
            isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
          } transition-colors duration-200`}
        >
          {isListening ? '停止检测' : '开始检测'}
        </button>
      </div>

      <div className="text-center space-y-4">
        <div className="text-2xl font-bold">
          {currentFrequency ? `${currentFrequency.toFixed(2)} Hz` : '-- Hz'}
        </div>
        
        <div className={`text-3xl font-bold ${getDeviationColor()}`}>
          {deviation !== null ? `${getDeviationArrow()} ${Math.abs(deviation).toFixed(2)} Hz` : '-- Hz'}
        </div>

        <div className="text-lg">
          {isInTune === true && '音准正确 ✓'}
          {isInTune === false && '请调整琴弦'}
          {isInTune === null && '等待检测...'}
        </div>
      </div>
    </div>
  );
};

export default ViolinTuner;