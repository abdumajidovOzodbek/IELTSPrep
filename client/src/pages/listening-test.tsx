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

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["/api/questions/listening"],
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

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
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

  if (isLoading || !session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading test questions...</p>
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

            <AudioPlayer 
              audioUrl={questions[0]?.audioUrl || "/audio/sample.mp3"}
              isPlaying={false}
              onPlayStateChange={() => {}}
            />

            <QuestionPanel
              questions={questions}
              currentQuestion={currentQuestion}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              onNext={handleNext}
              onPrevious={handlePrevious}
              canGoNext={currentQuestion < questions.length - 1}
              canGoPrevious={currentQuestion > 0}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
