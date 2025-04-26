import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAudioDevices } from '../hooks/useAudioDevices';
import ViolinTuner from '../components/Tuner/ViolinTuner';
import Metronome from '../components/Metronome/Metronome';
import AudioDeviceSelector from '../components/AudioDeviceSelector';

const TunerMetronome: React.FC = () => {
  const router = useRouter();
  const { tab } = router.query; // 获取路由参数
  const { audioDevices, selectedAudioDevice, setSelectedAudioDevice } = useAudioDevices();

  const [activeTab, setActiveTab] = useState<'Tuner' | 'Metronome' | null>(null);
  const [instrument, setInstrument] = useState<string>('Violin');

  useEffect(() => {
    // 根据路由参数设置默认激活的标签页
    if (tab === 'Metronome') {
      setActiveTab('Metronome');
    } else {
      setActiveTab('Tuner');
    }
  }, [tab]);

  const renderTuner = () => {
    switch (instrument) {
      case 'Violin':
        return <ViolinTuner selectedAudioDevice={selectedAudioDevice} />;
      // 其他乐器可以在这里添加对应的组件
      default:
        return <p className="text-center text-gray-600">该乐器的调音器尚未开发。</p>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center p-4 bg-gray-800 text-white">
        <h1 className="text-xl font-bold">调音器 & 节拍器</h1>
        <button
          onClick={() => router.back()}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          返回
        </button>
      </header>

      <div className="flex justify-center space-x-4 mt-4">
        <button
          onClick={() => setActiveTab('Tuner')}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
            activeTab === 'Tuner' ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🎵 调音器
        </button>
        <button
          onClick={() => setActiveTab('Metronome')}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
            activeTab === 'Metronome' ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ⏱️ 节拍器
        </button>
      </div>

      {activeTab === 'Tuner' && (
        <div className="p-4">

          <div className="mt-4">
            <label className="block text-gray-700">选择音源设备:</label>
            <AudioDeviceSelector
              audioDevices={audioDevices}
              selectedAudioDevice={selectedAudioDevice}
              setSelectedAudioDevice={setSelectedAudioDevice}
            />
          </div>

          <div className="mt-4">
            <label className="block text-gray-700">选择乐器:</label>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-white border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
            >
              <option value="Violin">🎻 小提琴</option>
              <option value="Viola">🎻 中提琴</option>
              <option value="Cello">🎻 大提琴</option>
              <option value="Guitar">🎸 吉他</option>
              <option value="Ukulele">🎸 尤克里里</option>
            </select>
          </div>

          <div className="mt-4">{renderTuner()}</div>
        </div>
      )}

      {activeTab === 'Metronome' && (
        <Metronome />
      )}
    </div>
  );
};

export default TunerMetronome;