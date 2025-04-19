import React, { forwardRef, useImperativeHandle } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

export interface AudioPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void; // 跳转到指定时间
  getCurrentTime: () => number; // 获取当前播放时间
}

interface CustomAudioPlayerProps {
  isPerformceModel: boolean;
  audioUrl: string | undefined;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}

const CustomAudioPlayer = forwardRef<AudioPlayerRef, CustomAudioPlayerProps>(
  ({ isPerformceModel, audioUrl, isPlaying, onPlay, onPause, onEnded }, ref) => {
    const playerRef = React.useRef<any>(null);

    useImperativeHandle(ref, () => ({
      play: () => {
        playerRef.current?.audio.current.play();
      },
      pause: () => {
        playerRef.current?.audio.current.pause();
      },
      seekTo: (time: number) => {
        if (playerRef.current?.audio.current) {
          playerRef.current.audio.current.currentTime = time; // 跳转到指定时间
        }
      },
      getCurrentTime: () => {
        return playerRef.current?.audio.current?.currentTime || 0; // 返回当前播放时间
      },
    }));

    // Cleanup
    React.useEffect(() => {
      return () => {
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
      };
    }, [isPerformceModel,audioUrl]);

    return (
      <div>
        <AudioPlayer
          ref={playerRef}
          src={audioUrl}
          showSkipControls={false}
          showJumpControls={false}
          showDownloadProgress={false}
          autoPlay={isPlaying}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
        />
      </div>
    );
  }
);

export default CustomAudioPlayer;
