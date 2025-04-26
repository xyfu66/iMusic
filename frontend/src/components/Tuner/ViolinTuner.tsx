import React, { useState, useEffect, useRef } from 'react';
import { BE_Url_Local } from '../../utils/common';

interface TunerProps {
  selectedAudioDevice: number;
}

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

const ViolinTuner: React.FC<TunerProps> = ({ selectedAudioDevice }) => {
  const [currentFrequency, setCurrentFrequency] = useState<number | null>(null);
  const [selectedString, setSelectedString] = useState<string>('G');
  const [deviation, setDeviation] = useState<number | null>(null);
  const [isInTune, setIsInTune] = useState<boolean | null>(null);
  const [hasAudioInput, setHasAudioInput] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0);
  const [noSoundDetected, setNoSoundDetected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const noSoundTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startPitchDetection();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (noSoundTimer.current) {
        clearTimeout(noSoundTimer.current);
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
      ws.send(JSON.stringify({ device_index: selectedAudioDevice }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const now = Date.now();
        
        // 限制更新频率为每秒30次
        if (now - lastUpdateTime.current < 30) return;
        lastUpdateTime.current = now;

        if (data.no_sound) {
          setCurrentFrequency(null);
          setVolume(0);
          setDeviation(null);
          setIsInTune(null);
          return;
        }

        if (data.frequency) {
          setHasAudioInput(true);
          setCurrentFrequency(data.frequency);
          setVolume(data.volume || 0);
          
          const targetFrequency = violinTuningNotes.find(note => note.string === selectedString)?.frequency!;
          const currentDeviation = data.frequency - targetFrequency;
          setDeviation(currentDeviation);
          setIsInTune(Math.abs(currentDeviation) < 1);
          
          // 重置无声音检测
          setNoSoundDetected(false);
          if (noSoundTimer.current) {
            clearTimeout(noSoundTimer.current);
          }
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

  // 设置无声音检测定时器
  useEffect(() => {
    if (hasAudioInput && !noSoundDetected) {
      if (noSoundTimer.current) {
        clearTimeout(noSoundTimer.current);
      }
      noSoundTimer.current = setTimeout(() => {
        setNoSoundDetected(true);
      }, 2000); // 2秒没有声音就提示
    }
  }, [hasAudioInput, currentFrequency]);

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

  const getDeviationPercentage = () => {
    if (deviation === null) return 0;
    const targetFrequency = violinTuningNotes.find(note => note.string === selectedString)?.frequency!;
    return (Math.abs(deviation) / targetFrequency) * 100;
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="mb-8">
        <div className="relative h-48">
          <div className="absolute inset-0 flex flex-col justify-between">
            {violinTuningNotes.map((note) => (
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

        {noSoundDetected && (
          <div className="text-blue-600 bg-blue-100 p-4 rounded-lg">
            好像没有声音哦~
          </div>
        )}

        <div className="text-2xl font-bold">
          {currentFrequency ? `${currentFrequency.toFixed(2)} Hz` : '-- Hz'}
        </div>

        {/* 音量指示器 */}
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${Math.min(volume * 100, 100)}%` }}
          ></div>
        </div>
        
        {/* 音高偏差指示器 */}
        <div className="relative h-16 bg-gray-100 rounded-lg overflow-hidden">
          <div 
            className={`absolute top-0 h-full w-1 bg-current ${getDeviationColor()}`}
            style={{ 
              left: `${50 + (deviation ? Math.min(Math.max(deviation * 10, -50), 50) : 0)}%`,
              transition: 'left 0.1s ease-out'
            }}
          ></div>
          <div className="absolute top-0 left-1/2 h-full w-1 bg-green-500"></div>
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