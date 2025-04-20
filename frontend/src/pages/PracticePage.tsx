import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router'; // 导入路由
import CustomAudioPlayer from '../components/CustomAudioPlayer';
import AudioInputVisualizer from '../components/AudioInputVisualizer';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { AudioPlayerRef } from '../components/CustomAudioPlayer';
import { decodeBase64, FileType, getCloudBackendUrl, getDeviceBackendUrl, getFileUrl } from '../utils/common'; // 导入共通方法
import { useRecoilValue } from 'recoil';
import { practiceState } from '../state/practiceState';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { Menu } from '@headlessui/react';


const BE_Url_Local = getDeviceBackendUrl();
const BE_Url_Cloud = getCloudBackendUrl();
const MIDI = 'MIDI';
const AUDIO = 'Audio';

const PracticePage: React.FC = () => {
  const router = useRouter();
  const practiceData = useRecoilValue(practiceState);
  const { audioDevices, selectedAudioDevice, setSelectedAudioDevice } = useAudioDevices();

  const vfRef = useRef<HTMLDivElement>(null);
  const osmd = useRef<OpenSheetMusicDisplay | null>(null);
  const cursor = useRef<any>(null);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const fileId = useRef<string | null>(null);
  const timeIndexMap = useRef<{ [key: number]: number }>({}); // timeIndexMap: { time: index }
  const ws = useRef<WebSocket | null>(null);
  const uniqueNotesWRest = useRef<any[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [inputType, setInputType] = useState<typeof MIDI | typeof AUDIO>(MIDI);
  const [midiDevices, setMidiDevices] = useState<{ name: string; id: string }[]>([]);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState<string>('');
  const [anchorPositionIndex, setAnchorPositionIndex] = useState<number>(0);
  const [realTimePosition, setRealTimePosition] = useState<number>(0);
  const [pausedTime, setPausedTime] = useState(0); // 记录暂停时间
  const [isPerformceModel, setIsPerformceModel] = useState<boolean>(false); // 是否为演示模式
  const [performanceFile, setPerformanceFile] = useState<Blob | null>(null); // 演示模式下的文件
  const [practiceMode, setPracticeMode] = useState<'follow' | 'demo' | 'evaluate'>('follow');


  // Compute audio URL
  const audioUrlToPlay = useMemo(() => {
    if (!practiceData) return undefined;

    if (practiceData.useUrl === 'true') return practiceData.audioUrl;
    if (practiceData.audioContent) {
      const audioBlob = typeof practiceData.audioContent === 'string' ? decodeBase64(practiceData.audioContent) : null;
      return audioBlob ? URL.createObjectURL(audioBlob) : undefined;
    }
    return undefined;
  }, [isPerformceModel]);

  useEffect(() => {
      console.log(`Real-time position: ${realTimePosition}, Anchor position index: ${anchorPositionIndex}`);
      if (realTimePosition !== anchorPositionIndex) {
      moveToTargetBeat(realTimePosition);
      console.log("realTimePosition: ", realTimePosition);
      setAnchorPositionIndex(realTimePosition);
      console.log('Best position updated to:', anchorPositionIndex);
      }
  }, [realTimePosition]);
  
  useEffect(() => {
    if (!vfRef.current || !practiceData) return;
    
    fileId.current = practiceData.fileInfo.id;
    
    // 初始化OSMD
    osmd.current = new OpenSheetMusicDisplay(vfRef.current);
    console.log('OSMD initialized');

    const loadFile = async () => {
      try {
        if (practiceData.useUrl === 'false' && practiceData.fileContent) {
          const originBlob = decodeBase64(practiceData.fileContent);
          if (originBlob === null) return;

          const text = await originBlob.text();
          await osmd.current!.load(text);
          await osmd.current!.render();
          cursor.current = osmd.current!.cursor;
          console.log('Cursor initialized:', cursor.current);

          registerNoteFromOsmd(osmd.current!);
          if (cursor.current) {
            cursor.current.reset();
            cursor.current.show();
            console.log('Cursor position after reset:', cursor.current.Iterator.currentTimeStamp.RealValue);
          }
        } else if (practiceData.useUrl === 'true' && practiceData.fileUrl) {

          const response = await fetch(getFileUrl(practiceData.fileInfo.id, FileType.SCORE));
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const content = await response.text();

          await osmd.current!.load(content);
          await osmd.current!.render();
          cursor.current = osmd.current!.cursor;
          console.log('Cursor initialized:', cursor.current);

          registerNoteFromOsmd(osmd.current!);
          if (cursor.current) {
            cursor.current.reset();
            cursor.current.show();
            console.log('Cursor position after reset:', cursor.current.Iterator.currentTimeStamp.RealValue);
          }
        }
      } catch (error) {
        console.error('Error loading file:', error);
      }
    };

    loadFile();
  }, [practiceData]);

  useEffect(() => {
    if (inputType === AUDIO) {
      if (audioDevices.length > 0) {
        setSelectedAudioDevice(audioDevices[0].index);
      }
    } else if (inputType === MIDI) {
      fetchMidiDevices();
    }
  }, [inputType]);

  const moveToTargetBeat = (targetBeat: number) => {
    logWithTimestamp(`Moving to target beat: ${targetBeat}`);
    if (!osmd.current) return;
    
    cursor.current = osmd.current.cursor;
    
    if (cursor.current) {
      const currentBeat = getCursorCurrentPosition();
      const currentIndex = timeIndexMap.current[currentBeat];
      let targetIndex = timeIndexMap.current[targetBeat];

      if (currentIndex === undefined) {
        logWithTimestamp(`Invalid current beat position. Cursor's current beat: ${currentBeat}`);
        return;
      }

      if (targetIndex === undefined) {
        const onsetBeats = Object.keys(timeIndexMap.current).map(Number).sort((a, b) => a - b);
        const closestIndex = findClosestIndex(onsetBeats, targetBeat);
        targetIndex = timeIndexMap.current[onsetBeats[closestIndex]];
        logWithTimestamp(`Closest target index found: ${targetIndex}`);
      }

      const steps = targetIndex - currentIndex;
      logWithTimestamp(`Steps to move: ${steps}`);

      if (steps > 0) {
        for (let i = 0; i < steps; i++) {
          cursor.current.next();
        }
      } else if (steps < 0) {
        for (let i = 0; i < Math.abs(steps); i++) {
          cursor.current.previous();
        }
      }

      osmd.current.cursor.update();
      cursor.current.show();
    }
  };

  
  const getCursorCurrentPosition = () => {
    if (cursor.current && cursor.current.Iterator) {
      return cursor.current.Iterator.currentTimeStamp.RealValue * 4;
    }
    return 0;
  };

  const logWithTimestamp = (message: string) => {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] ${message}`);
  };

  const findClosestIndex = (array: number[], target: number) => {
    let closestIndex = array.findLastIndex((value) => value <= target);
    if (closestIndex === -1) {
      closestIndex = 0;
    }
    return closestIndex;
  };

  const registerNoteFromOsmd = (osmd: OpenSheetMusicDisplay) => {
    if (osmd && osmd.cursor) {
      let iterator = osmd.cursor.Iterator;

      var allNotes = [];
      var allNotesWRest = [];

      while (!iterator.EndReached) {
        const voices = iterator.CurrentVoiceEntries;
        for (var i = 0; i < voices.length; i++) {
          const v = voices[i];
          const notes = v.Notes;
          for (var j = 0; j < notes.length; j++) {
            const note = notes[j];
            if (note != null) {
              allNotesWRest.push({
                note: note.halfTone + 12,
                time: iterator.currentTimeStamp.RealValue * 4,
                length: note.Length.RealValue,
              });
            }
          }
        }
        iterator.moveToNext();
      }

      const uniqueNotesWRestArray: { note: number; time: number; length: number }[] = [];
      const timeIndexMapObj: { [key: number]: number } = {};
      allNotesWRest.forEach((note, index) => {
        if (!timeIndexMapObj.hasOwnProperty(note.time)) {
          uniqueNotesWRestArray.push(note);
          timeIndexMapObj[note.time] = uniqueNotesWRestArray.length - 1;
        }
      });

      uniqueNotesWRest.current = uniqueNotesWRestArray;
      timeIndexMap.current = timeIndexMapObj;
      cursor.current = osmd.cursor;
    }
  };

  // 获取 MIDI 设备
  const fetchMidiDevices = async () => {
    try {
      const response = await fetch(`${BE_Url_Local}/midi-devices`);
      const data = await response.json();
      setMidiDevices(data.devices);
      if (data.devices.length > 0) {
        setSelectedMidiDevice(data.devices[0].id);
      }
    } catch (error) {
      console.error('Error fetching MIDI devices:', error);
    }
  };

  const playMusic = async () => {
    if (!cursor.current || !fileId.current) return;

    if (performanceFile) {
      audioPlayerRef.current?.play();
    }

    setIsPlaying(true);
    console.log('Starting music playback...');
    cursor.current.reset();

    const wsUrl = `${BE_Url_Local.replace(/^http/, 'ws')}/ws`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connection opened');

      ws.current?.send(
        JSON.stringify({
          file_id: fileId.current,
          input_type: inputType.toLowerCase(),
          isPerformceModel: isPerformceModel,
          device: isPerformceModel ? '' : inputType === AUDIO ? selectedAudioDevice : selectedMidiDevice,
        })
      );
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      if (data.beat_position !== undefined) {
        moveToTargetBeat(data.beat_position);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket connection closed');
      setIsPlaying(false);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsPlaying(false);
    };
  };

  
  const pauseMusic = () => {
    if (audioPlayerRef.current) {
      const currentTime = audioPlayerRef.current.getCurrentTime(); // 获取当前播放时间
      setPausedTime(currentTime); // 保存暂停时间
      audioPlayerRef.current.pause();
    }
    setIsPlaying(false);
    console.log('Music paused');
  };

  const stopMusic = () => {
    console.log('Stopping music');
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.seekTo(0); // 重置到起始位置
    }
    setPausedTime(0); // 重置暂停时间
    setIsPlaying(false);
    if (ws.current) {
      ws.current.close();
      ws.current = null;
      console.log('WebSocket connection closed');
    }
  };

  const fetchDemoAudio = async (fileId: string) => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/cloud/get-audio-file-by-id/${fileId}`);
      if (response.ok) {
        const blob = await response.blob();
        setPerformanceFile(blob);
      }
    } catch (error) {
      console.error('Error fetching demo audio:', error);
    }
  };

  useEffect(() => {
    if (practiceMode === 'demo') {
      setIsPerformceModel(true);
      if (fileId.current) {
        fetchDemoAudio(fileId.current);
      }
    } else {
      setIsPerformceModel(false);
      setPerformanceFile(null);
    }
  }, [practiceMode]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header 部分 */}
      <header className="flex justify-between items-center p-4 bg-gray-800 text-white">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">Practice</h1>
          <Menu as="div" className="relative">
            <Menu.Button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
              {practiceMode === 'follow' && '跟音练习'}
              {practiceMode === 'demo' && '演示模式'}
              {practiceMode === 'evaluate' && '测评模式'}
            </Menu.Button>
            <Menu.Items className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? 'bg-blue-500 text-white' : 'text-gray-900'
                    } group flex w-full items-center px-4 py-2 text-sm`}
                    onClick={() => setPracticeMode('follow')}
                  >
                    跟音练习
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? 'bg-blue-500 text-white' : 'text-gray-900'
                    } group flex w-full items-center px-4 py-2 text-sm`}
                    onClick={() => setPracticeMode('demo')}
                  >
                    演示模式
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? 'bg-blue-500 text-white' : 'text-gray-900'
                    } group flex w-full items-center px-4 py-2 text-sm`}
                    onClick={() => setPracticeMode('evaluate')}
                  >
                    测评模式
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
        <button
          onClick={() => router.back()}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          返回
        </button>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 pb-32">
        <div className="flex flex-col items-center space-y-3 py-2">
          <div className="flex space-x-4 items-center">
            <button
              onClick={() => setInputType(AUDIO)}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                inputType === AUDIO ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🎤 Audio
            </button>
            <button
              onClick={() => setInputType(MIDI)}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                inputType === MIDI ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🎹 MIDI
            </button>
          </div>

          {(practiceMode === 'follow' || practiceMode === 'evaluate') && (
            <>
              {inputType === AUDIO && (
                <div className="flex space-x-4 items-center">
                  <div className="w-64">
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
                  <div>
                    {inputType === AUDIO && (
                      <AudioInputVisualizer deviceIndex={selectedAudioDevice} />
                    )}
                  </div>
                </div>
              )}

              {inputType === MIDI && (
                <div className="w-64 mt-4">
                  <select
                    value={selectedMidiDevice}
                    onChange={(e) => setSelectedMidiDevice(e.target.value)}
                    className="w-full px-4 py-2 rounded-md bg-white border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                  >
                    {midiDevices.map((device, index) => (
                      <option key={index} value={device.id}>
                        {device.name || `MIDI Device ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="flex space-x-4 mt-4">
            <button
              onClick={playMusic}
              disabled={isPlaying}
              className={`flex items-center px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                !isPlaying ? 'bg-green-500 text-white hover:bg-green-600 shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="mr-2">▶️</span> Play
            </button>
            <button
              onClick={pauseMusic}
              disabled={!isPlaying}
              className={`flex items-center px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                isPlaying ? 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="mr-2">⏸️</span> Pause
            </button>
            <button
              onClick={stopMusic}
              disabled={!isPlaying}
              className={`flex items-center px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                isPlaying ? 'bg-red-500 text-white hover:bg-red-600 shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="mr-2">⏹️</span> Stop
            </button>
          </div>
        </div>

        {/* osmdContainer */}
        <div ref={vfRef} id="osmdContainer" ></div>

        {practiceMode === 'demo' && (
          <CustomAudioPlayer
            ref={audioPlayerRef}
            isPerformceModel={isPerformceModel}
            audioUrl={audioUrlToPlay}
            isPlaying={isPlaying}
            onPlay={() => {
              if (!isPlaying) playMusic();
            }}
            onPause={() => {
              if (isPlaying) stopMusic();
            }}
            onEnded={stopMusic}
          />
        )}

        {practiceMode === 'evaluate' && (
          <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-lg">
            <div className="container mx-auto flex justify-between items-center">
              <span className="text-gray-700">录音中...</span>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                onClick={() => {
                  // TODO: 实现录音上传和评测功能
                }}
              >
                结束录音并评测
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticePage;