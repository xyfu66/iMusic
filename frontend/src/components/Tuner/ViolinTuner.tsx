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
  const [deviation, setDeviation] = useState<number | null>(null);
  const [isInTune, setIsInTune] = useState<boolean | null>(null);
  const [hasAudioInput, setHasAudioInput] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 组件挂载时自动开始检测
    startPitchDetection();

    // 组件卸载时清理
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        console.log('wsRef.current.close');
      }
    };
  }, []);

  const startPitchDetection = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(BE_Url_Local.replace(/^http/, 'ws') + '/ws/tuner/violin');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Violin tuner WebSocket connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.frequency) {
          setHasAudioInput(true);
          setCurrentFrequency(data.frequency);
          const targetFrequency = violinTuningNotes.find(note => note.string === selectedString)?.frequency!;
          const currentDeviation = data.frequency - targetFrequency;
          setDeviation(currentDeviation);
          setIsInTune(Math.abs(currentDeviation) < 1);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };
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
      <div className="mb-8">
        <div className="relative h-48">
          {/* 小提琴弦的视觉展示 */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {violinTuningNotes.map((note, index) => (
              <div
                key={note.string}
                className={`flex items-center justify-between h-12 px-4 rounded-lg transition-all duration-200 ${
                  selectedString === note.string ? 'bg-blue-100' : 'bg-gray-100'
                }`}
                onClick={() => setSelectedString(note.string)}
              >
                <div className="flex items-center">
                  <div className="w-2 h-8 bg-gray-800 rounded-full mr-4"></div>
                  <span className="text-lg font-bold">{note.string}弦</span>
                </div>
                <div className="text-sm text-gray-600">
                  {note.note} ({note.frequency} Hz)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center space-y-4">
        {!hasAudioInput && (
          <div className="text-yellow-600 bg-yellow-100 p-4 rounded-lg">
            未检测到音频输入，请确保麦克风已连接并允许访问
          </div>
        )}

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