import React, { useEffect, useRef } from 'react';

interface AudioInputVisualizerProps {
  deviceIndex: number;
}

const AudioInputVisualizer: React.FC<AudioInputVisualizerProps> = ({ deviceIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceIndex.toString(),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        source.connect(analyser);

        draw();

        return () => {
          if (sourceRef.current) {
            sourceRef.current.disconnect();
          }
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
        };
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };

    setupAudio();
  }, [deviceIndex]);

  const draw = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = 'rgb(240, 240, 240)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height;

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#4ade80');
      gradient.addColorStop(0.5, '#fbbf24');
      gradient.addColorStop(1, '#ef4444');

      ctx.fillStyle = gradient;
      
      const radius = 2;
      ctx.beginPath();
      ctx.moveTo(x + radius, canvas.height);
      ctx.lineTo(x + barWidth - radius, canvas.height);
      ctx.quadraticCurveTo(x + barWidth, canvas.height, x + barWidth, canvas.height - radius);
      ctx.lineTo(x + barWidth, canvas.height - barHeight + radius);
      ctx.quadraticCurveTo(x + barWidth, canvas.height - barHeight, x + barWidth - radius, canvas.height - barHeight);
      ctx.lineTo(x + radius, canvas.height - barHeight);
      ctx.quadraticCurveTo(x, canvas.height - barHeight, x, canvas.height - barHeight + radius);
      ctx.lineTo(x, canvas.height - radius);
      ctx.quadraticCurveTo(x, canvas.height, x + radius, canvas.height);
      ctx.closePath();
      ctx.fill();

      x += barWidth + 1;
    }

    animationRef.current = requestAnimationFrame(draw);
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="h-10 w-48 bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        <canvas
          ref={canvasRef}
          width={192}
          height={40}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default AudioInputVisualizer;