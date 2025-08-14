import { useState, useEffect, useRef, useCallback } from "react";

export interface AudioState {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  isLoaded: boolean;
  volume: number;
  isMuted: boolean;
  isBuffering: boolean;
  error: string | null;
}

export function useAudio(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    isLoaded: false,
    volume: 0.75,
    isMuted: false,
    isBuffering: false,
    error: null
  });

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const updateState = (updates: Partial<AudioState>) => {
      setState(prev => ({ ...prev, ...updates }));
    };

    // Event listeners
    const handleLoadStart = () => updateState({ isBuffering: true, error: null });
    const handleLoadedData = () => updateState({ 
      isLoaded: true, 
      isBuffering: false,
      duration: audio.duration 
    });
    const handleTimeUpdate = () => updateState({ currentTime: audio.currentTime });
    const handlePlay = () => updateState({ isPlaying: true });
    const handlePause = () => updateState({ isPlaying: false });
    const handleEnded = () => updateState({ isPlaying: false, currentTime: 0 });
    const handleError = () => updateState({ 
      error: "Failed to load audio", 
      isBuffering: false 
    });
    const handleWaiting = () => updateState({ isBuffering: true });
    const handleCanPlay = () => updateState({ isBuffering: false });

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    // Set initial volume
    audio.volume = state.volume;

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  // Update audio volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.isMuted ? 0 : state.volume;
    }
  }, [state.volume, state.isMuted]);

  const play = useCallback(async () => {
    if (!audioRef.current) return;
    
    try {
      await audioRef.current.play();
    } catch (error) {
      setState(prev => ({ ...prev, error: "Playback failed" }));
    }
  }, []);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, state.duration));
  }, [state.duration]);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState(prev => ({ ...prev, volume: clampedVolume, isMuted: false }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const skipForward = useCallback((seconds: number = 10) => {
    if (!audioRef.current) return;
    const newTime = Math.min(audioRef.current.currentTime + seconds, state.duration);
    seekTo(newTime);
  }, [seekTo, state.duration]);

  const skipBackward = useCallback((seconds: number = 10) => {
    if (!audioRef.current) return;
    const newTime = Math.max(audioRef.current.currentTime - seconds, 0);
    seekTo(newTime);
  }, [seekTo]);

  const replay = useCallback(() => {
    seekTo(0);
    play();
  }, [seekTo, play]);

  return {
    ...state,
    play,
    pause,
    seekTo,
    setVolume,
    toggleMute,
    skipForward,
    skipBackward,
    replay,
    audioElement: audioRef.current
  };
}

// Hook for recording audio
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setError(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        stopRecording();
      }
    };
  }, [isRecording, stopRecording]);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    clearRecording
  };
}
