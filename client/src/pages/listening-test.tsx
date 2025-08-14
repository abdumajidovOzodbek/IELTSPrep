import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TestHeader from "@/components/test-header";
import TestNavigation from "@/components/test-navigation";
import AudioPlayer from "@/components/audio-player";
import QuestionPanel from "@/components/question-panel";
import { useTestSession } from "@/hooks/use-test-session";

export default function ListeningTest() {
  const { sessionId } = useParams();
  const { session, updateSession } = useTestSession(sessionId);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Generate AI listening content with audio
  const { data: listeningContent, isLoading: isGenerating } = useQuery({
    queryKey: ["/api/ai/listening/generate"],
    staleTime: 300000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["/api/questions/listening"],
    enabled: false, // Disable static questions, use AI-generated content
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async (answerData: any) => {
      const response = await apiRequest("POST", "/api/answers", answerData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/answers`] });
    }
  });

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    // Auto-save answer
    submitAnswerMutation.mutate({
      sessionId,
      questionId,
      answer,
      timeSpent: 0 // Would track actual time spent
    });
  };

  // Use AI-generated content if available, otherwise fall back to static questions
  const activeQuestions = listeningContent?.sections?.[0]?.questions || questions;
  const audioUrl = listeningContent?.sections?.[0]?.audioUrl;
  
  const handleNext = () => {
    if (currentQuestion < activeQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Move to next section
      updateSession({ currentSection: "reading" });
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  if (isGenerating || isLoading || !session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">
          {isGenerating ? "Generating AI-powered listening test with audio..." : "Loading test questions..."}
        </p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TestHeader session={session} />
      
      <div className="flex flex-1">
        <TestNavigation currentSection="listening" sessionId={sessionId} />
        
        <main className="flex-1 p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Section Header */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Listening Test</h1>
                  <p className="text-slate-600 mt-1">Section 1 of 4 • Questions 1-10</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">25:30</div>
                  <div className="text-sm text-slate-600">Time remaining</div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
                <p className="text-blue-800 text-sm">
                  You will hear a conversation between a student and a receptionist. 
                  First, you have some time to look at questions 1 to 10. You will see that there is an example that has been done for you.
                </p>
              </div>
            </div>

            {audioUrl ? (
              <AudioPlayer 
                audioUrl={audioUrl}
                isPlaying={false}
                onPlayStateChange={() => {}}
                allowSeeking={false}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Audio Player</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 text-sm">
                    AI is generating your personalized listening test with high-quality audio. 
                    This may take a moment...
                  </p>
                </div>
              </div>
            )}

            {activeQuestions.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Question {currentQuestion + 1} of {activeQuestions.length}
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="text-slate-800">
                    {activeQuestions[currentQuestion]?.question}
                  </div>
                  
                  {activeQuestions[currentQuestion]?.options && (
                    <div className="space-y-2">
                      {activeQuestions[currentQuestion].options.map((option: string, index: number) => (
                        <label key={index} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${currentQuestion}`}
                            value={option}
                            checked={answers[activeQuestions[currentQuestion]?.id] === option}
                            onChange={(e) => handleAnswerChange(activeQuestions[currentQuestion]?.id, e.target.value)}
                            className="w-4 h-4 text-primary border-slate-300 focus:ring-primary"
                          />
                          <span className="text-slate-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between pt-4">
                    <button
                      onClick={handlePrevious}
                      disabled={currentQuestion === 0}
                      className="px-4 py-2 text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    
                    <button
                      onClick={handleNext}
                      className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                    >
                      {currentQuestion < activeQuestions.length - 1 ? "Next Question" : "Complete Section"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
