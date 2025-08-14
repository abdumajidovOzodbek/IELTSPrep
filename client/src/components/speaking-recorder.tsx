import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Pause,
  Volume2,
  BarChart3,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SpeakingRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (transcript: string) => void;
  preparationComplete: boolean;
}

export default function SpeakingRecorder({
  isRecording,
  onStartRecording,
  onStopRecording,
  preparationComplete
}: SpeakingRecorderProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [realTimeAnalysis, setRealTimeAnalysis] = useState({
    fluency: 7.5,
    vocabulary: 7.0,
    pronunciation: 6.5
  });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Mock audio level animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setAudioLevel(Math.random() * 100);
      }, 100);
    } else {
      setAudioLevel(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    if (!preparationComplete) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        // In a real implementation, you'd send this to the server for transcription
        const mockTranscript = "I visited Bali, Indonesia last summer during my university break. It was an absolutely memorable experience because of the rich culture and beautiful landscapes. The temples were magnificent, especially Tanah Lot which sits dramatically on a rock formation. The local people were incredibly friendly and welcoming. I spent time learning about their traditions, trying local cuisine like nasi goreng and satay, and participating in cultural ceremonies. The beaches were pristine with crystal clear water, and I enjoyed activities like snorkeling and surfing. What made it most memorable was the spiritual atmosphere - the daily offerings, the sound of gamelan music, and the peaceful energy everywhere. It was a perfect blend of adventure, cultural immersion, and relaxation that left a lasting impact on me.";
        setTranscript(mockTranscript);
        onStopRecording(mockTranscript);
        setHasRecorded(true);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecordingTime(0);
      onStartRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const getRecordingStatus = () => {
    if (!preparationComplete) return { text: "Preparation Phase", color: "bg-blue-500" };
    if (isRecording) return { text: "Recording", color: "bg-red-500" };
    if (hasRecorded) return { text: "Recording Complete", color: "bg-green-500" };
    return { text: "Ready to Record", color: "bg-slate-400" };
  };

  const status = getRecordingStatus();

  return (
    <div className="space-y-6">
      {/* Recording Status */}
      <Card>
        <CardContent className="p-6 text-center">
          <div className="mb-6">
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-300",
              status.color,
              isRecording && "animate-pulse"
            )}>
              <Mic className="h-16 w-16 text-white" />
            </div>
            
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {status.text}
            </h3>
            
            <p className="text-slate-600">
              {!preparationComplete 
                ? "Use this time to plan your response" 
                : isRecording 
                  ? "Speak clearly into your microphone"
                  : hasRecorded
                    ? "Your response has been recorded successfully"
                    : "Click the button below when you're ready to start speaking"
              }
            </p>
          </div>

          {/* Timer */}
          <div className="mb-6">
            <div className="text-4xl font-bold text-primary mb-2">
              {formatTime(recordingTime)}
            </div>
            {isRecording && (
              <div className="w-64 bg-slate-200 rounded-full h-2 mx-auto mb-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min((recordingTime / 120) * 100, 100)}%` }}
                />
              </div>
            )}
            <p className="text-sm text-slate-500">
              {isRecording 
                ? "Recording in progress" 
                : hasRecorded 
                  ? "Recording completed"
                  : preparationComplete 
                    ? "Ready to record (1-2 minutes)" 
                    : "Preparation time"
              }
            </p>
          </div>

          {/* Audio Visualizer */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-1 h-16">
              {[...Array(16)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 rounded-full transition-all duration-150",
                    isRecording ? "bg-primary" : "bg-slate-300"
                  )}
                  style={{
                    height: isRecording 
                      ? `${Math.random() * 40 + 10}px` 
                      : "10px",
                    animationDelay: `${i * 50}ms`
                  }}
                />
              ))}
            </div>
            <p className="text-sm text-slate-600 mt-2">Audio level visualization</p>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4">
            <Button
              variant="outline"
              size="lg"
              disabled={!hasRecorded}
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-full"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            
            <Button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={!preparationComplete && !isRecording}
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className="w-16 h-16 rounded-full"
            >
              {isRecording ? (
                <Square className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              disabled
              className="w-12 h-12 rounded-full"
            >
              <Volume2 className="h-5 w-5" />
            </Button>
          </div>

          <p className="text-sm text-slate-500 mt-4">
            {!preparationComplete 
              ? "Recording will be available after preparation time"
              : isRecording 
                ? "Click stop when you've finished your response"
                : "Make sure you're in a quiet environment"
            }
          </p>
        </CardContent>
      </Card>

      {/* Real-time Speaking Analysis */}
      {(isRecording || hasRecorded) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <span>Real-time Speaking Analysis</span>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                AI Powered
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-700 mb-2">
                  {realTimeAnalysis.fluency}
                </div>
                <div className="text-sm font-medium text-slate-700 mb-2">Fluency</div>
                <Progress value={realTimeAnalysis.fluency * 10} className="h-2" />
                <p className="text-xs text-slate-600 mt-2">Natural pace and rhythm</p>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-green-700 mb-2">
                  {realTimeAnalysis.vocabulary}
                </div>
                <div className="text-sm font-medium text-slate-700 mb-2">Vocabulary</div>
                <Progress value={realTimeAnalysis.vocabulary * 10} className="h-2" />
                <p className="text-xs text-slate-600 mt-2">Word choice and variety</p>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-700 mb-2">
                  {realTimeAnalysis.pronunciation}
                </div>
                <div className="text-sm font-medium text-slate-700 mb-2">Pronunciation</div>
                <Progress value={realTimeAnalysis.pronunciation * 10} className="h-2" />
                <p className="text-xs text-slate-600 mt-2">Clarity and accuracy</p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Live Feedback</span>
              </div>
              <p className="text-sm text-blue-800">
                {isRecording 
                  ? "Great fluency and clear pronunciation. Try to use more varied vocabulary to enhance your response."
                  : "Your response shows good overall performance. The AI has completed its analysis."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcript Display */}
      {hasRecorded && transcript && (
        <Card>
          <CardHeader>
            <CardTitle>Your Response Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-slate-900 leading-relaxed">{transcript}</p>
            </div>
            <p className="text-sm text-slate-600 mt-3">
              This transcript was automatically generated and will be used for evaluation.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
