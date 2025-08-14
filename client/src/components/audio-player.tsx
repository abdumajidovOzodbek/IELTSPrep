import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useAudio } from "@/hooks/use-audio";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX,
  Info
} from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  allowSeeking?: boolean;
  showTranscript?: boolean;
}

export default function AudioPlayer({ 
  audioUrl, 
  isPlaying, 
  onPlayStateChange,
  allowSeeking = false,
  showTranscript = false 
}: AudioPlayerProps) {
  const {
    duration,
    currentTime,
    isLoaded,
    volume,
    isMuted,
    play,
    pause,
    seekTo,
    setVolume,
    toggleMute,
    skipBackward,
    skipForward
  } = useAudio(audioUrl);

  const [hasStarted, setHasStarted] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
      if (!hasStarted) setHasStarted(true);
    }
    onPlayStateChange(!isPlaying);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Audio Player</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
            {isPlaying ? "Playing" : hasStarted ? "Paused" : "Ready"}
          </Badge>
        </div>
      </div>
      
      {/* Audio Status Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-blue-900 text-sm font-medium mb-1">Audio Instructions</p>
            <p className="text-blue-800 text-sm">
              {allowSeeking 
                ? "You can control the audio playback and replay sections as needed."
                : "The recording will play automatically and cannot be paused or replayed. Listen carefully."
              }
            </p>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Main Controls */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => skipBackward(10)}
            disabled={!allowSeeking || !isLoaded}
            className="w-12 h-12"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          
          <Button
            onClick={handlePlayPause}
            disabled={!isLoaded}
            size="lg"
            className="w-16 h-16 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="lg" 
            onClick={() => skipForward(10)}
            disabled={!allowSeeking || !isLoaded}
            className="w-12 h-12"
          >
            <RotateCw className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          
          <div className="relative">
            <div className="w-full bg-slate-200 rounded-full h-3 cursor-pointer">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-300 relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-0 w-3 h-3 bg-white border-2 border-primary rounded-full transform translate-x-1/2"></div>
              </div>
            </div>
            
            {allowSeeking && (
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
                disabled={!isLoaded}
              />
            )}
          </div>
        </div>
        
        {/* Volume and Additional Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              disabled={!isLoaded}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              onValueChange={(value) => setVolume(value[0] / 100)}
              max={100}
              step={1}
              className="w-20"
              disabled={!isLoaded}
            />
          </div>
          
          <div className="text-sm text-slate-600">
            Section 1 Audio • {formatTime(duration)}
          </div>
        </div>
        
        {/* Waveform Visualization */}
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center justify-center space-x-1 h-16">
            {[...Array(32)].map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isPlaying ? 'bg-primary animate-pulse' : 'bg-slate-300'
                }`}
                style={{
                  height: `${Math.random() * 40 + 10}px`,
                  animationDelay: `${i * 50}ms`
                }}
              />
            ))}
          </div>
          <p className="text-center text-xs text-slate-600 mt-2">Audio visualization</p>
        </div>
      </div>
    </div>
  );
}
