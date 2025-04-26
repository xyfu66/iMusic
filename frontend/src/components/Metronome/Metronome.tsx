import React, { useState, useEffect, useRef } from 'react';

const Metronome: React.FC = () => {
  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setBeat((prev) => (prev + 1) % 4);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((error) => {
            console.error('Error playing audio:', error);
          });
        }
      }, (60 / bpm) * 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, bpm]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBpm(Number(event.target.value));
  };

  return (
    <div className="p-4">
      <div className="flex justify-center items-center space-x-4 mt-4">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {isPlaying ? '暂停' : '播放'}
        </button>
        <input
          type="range"
          min="30"
          max="320"
          value={bpm}
          onChange={handleSliderChange}
          className="w-64 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer transition-all duration-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: `linear-gradient(to right, #007bff ${(bpm - 30) / (320 - 30) * 100}%, #e0e0e0 ${(bpm - 30) / (320 - 30) * 100}%)`
          }}
          ref={sliderRef}
        />
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-16 text-center border border-gray-300 rounded"
        />
        <span>BPM</span>
      </div>
      <div className="flex justify-center mt-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 mx-1 rounded-full ${
              beat === i ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          ></div>
        ))}
      </div>
      <audio ref={audioRef} src="/click-sound.mp3" preload="auto" />
    </div>
  );
};

export default Metronome; 