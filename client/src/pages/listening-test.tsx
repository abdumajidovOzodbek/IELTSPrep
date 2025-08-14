import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TestHeader from "@/components/test-header";
import TestNavigation from "@/components/test-navigation";
import AudioPlayer from "@/components/audio-player";
import { useTestSession } from "@/hooks/use-test-session";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";

export default function ListeningTest() {
  const { sessionId } = useParams();
  const { session, updateSession, isLoading: sessionLoading, error: sessionError } = useTestSession(sessionId);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Generate AI listening content with audio
  const { data: listeningContent, isLoading: isGenerating } = useQuery({
    queryKey: ["/api/ai/listening/generate"],
    queryFn: async () => {
      try {
        const response = await apiRequest("POST", "/api/ai/listening/generate", {
          sessionId,
          difficulty: "intermediate"
        });
        return await response.json();
      } catch (error) {
        console.warn("AI content generation failed, using fallback");
        return null;
      }
    },
    staleTime: 300000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    retry: false, // Don't retry if AI generation fails
    enabled: !!sessionId, // Only run when we have a session
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["/api/questions/listening"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/questions/listening");
        const data = await response.json();
        console.log("Questions API response:", data);
        return data;
      } catch (error) {
        console.warn("Failed to load questions:", error);
        return { sections: [] }; // Return empty sections structure
      }
    },
    enabled: !!sessionId, // Load when we have a session
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async (answerData: any) => {
      const response = await apiRequest("POST", "/api/answers", answerData);
      return response.json();
    },
    onSuccess: () => {
      console.log("Answer saved successfully");
    },
    onError: (error) => {
      console.error("Failed to save answer:", error);
    }
  });

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    // Auto-save answer with proper validation
    if (sessionId && questionId && answer) {
      submitAnswerMutation.mutate({
        sessionId: sessionId,
        questionId: questionId,
        answer: answer,
        section: "listening",
        timeSpent: 30 // Placeholder time
      });
    }
  };

  // Use the properly structured IELTS 4-section format
  console.log("Generated AI Content:", listeningContent);
  console.log("Questions API Response:", questions);

  // Get all 4 sections from AI generated content or API
  const allSections = listeningContent?.sections || questions?.sections || [];
  const currentSectionData = allSections[currentSection];
  const activeQuestions = currentSectionData?.questions || [];
  const sectionTitle = currentSectionData?.title || `Section ${currentSection + 1}`;
  const sectionInstructions = currentSectionData?.instructions || "Listen carefully and answer all questions.";
  const transcript = currentSectionData?.transcript || "";
  const audioUrl = currentSectionData?.audioUrl;

  const handleNext = () => {
    if (currentQuestion < activeQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else if (currentSection < allSections.length - 1) {
      // Move to next section
      setCurrentSection(prev => prev + 1);
      setCurrentQuestion(0);
    } else {
      // All sections complete, move to reading test
      updateSession({ currentSection: "reading" });
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    } else if (currentSection > 0) {
      // Move to previous section
      setCurrentSection(prev => prev - 1);
      setCurrentQuestion(activeQuestions.length - 1);
    }
  };

  const goToSection = (sectionIndex: number) => {
    setCurrentSection(sectionIndex);
    setCurrentQuestion(0);
  };

  if (sessionLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading test session...</p>
      </div>
    </div>;
  }

  if (sessionError) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center text-red-600">
        <p>Error loading session: {sessionError.message}</p>
        <p>Session ID: {sessionId}</p>
      </div>
    </div>;
  }

  if (!session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center text-orange-600">
        <p>Session not found</p>
        <p>Session ID: {sessionId}</p>
      </div>
    </div>;
  }

  // Show loading only if both AI content and fallback questions are loading
  if (isGenerating && isLoading) {
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
                  <h1 className="text-2xl font-bold text-slate-900">{sectionTitle}</h1>
                  <p className="text-slate-600 mt-1">Section {currentSection + 1} of 4 • Questions {currentSection * 10 + 1}-{(currentSection + 1) * 10}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">25:30</div>
                  <div className="text-sm text-slate-600">Time remaining</div>
                </div>
              </div>

              {/* Section Navigation */}
              <div className="flex gap-2 mb-4">
                {allSections.map((_, index) => (
                  <Button
                    key={index}
                    variant={index === currentSection ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToSection(index)}
                    data-testid={`button-section-${index + 1}`}
                  >
                    Section {index + 1}
                  </Button>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
                <p className="text-blue-800 text-sm">
                  {sectionInstructions}
                </p>
                {transcript && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-blue-900 font-medium">View Transcript (for development)</summary>
                    <div className="mt-2 p-3 bg-white rounded border text-sm text-slate-700 whitespace-pre-wrap">
                      {transcript}
                    </div>
                  </details>
                )}
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
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Question {currentSection * 10 + currentQuestion + 1} of 40
                  </h3>
                  <div className="text-sm text-slate-600 mt-1">
                    Section {currentSection + 1}, Question {currentQuestion + 1} of {activeQuestions.length}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-slate-800 text-lg leading-relaxed">
                    {activeQuestions[currentQuestion]?.content?.question || activeQuestions[currentQuestion]?.question}
                  </div>

                  {activeQuestions[currentQuestion]?.content?.options && Array.isArray(activeQuestions[currentQuestion].content.options) && (
                    <div className="space-y-3">
                      {activeQuestions[currentQuestion].content.options.map((option: string, index: number) => (
                        <label key={index} className="flex items-center space-x-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                          <input
                            type="radio"
                            name={`question-${currentSection}-${currentQuestion}`}
                            value={option}
                            checked={answers[activeQuestions[currentQuestion]?._id] === option}
                            onChange={(e) => handleAnswerChange(activeQuestions[currentQuestion]?._id, e.target.value)}
                            className="w-4 h-4 text-primary border-slate-300 focus:ring-primary"
                          />
                          <span className="text-slate-700 flex-1">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {!activeQuestions[currentQuestion]?.content?.options && activeQuestions[currentQuestion]?.questionType === 'fill_blank' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Type your answer here..."
                        value={answers[activeQuestions[currentQuestion]?._id] || ''}
                        onChange={(e) => handleAnswerChange(activeQuestions[currentQuestion]?._id, e.target.value)}
                        className="w-full p-4 text-lg border border-slate-300 rounded-lg focus:ring-primary focus:border-primary"
                        data-testid="input-answer"
                      />
                    </div>
                  )}

                  {/* Enhanced Navigation */}
                  <div className="flex justify-between items-center pt-6 border-t border-slate-200">
                    <Button
                      onClick={handlePrevious}
                      disabled={currentQuestion === 0 && currentSection === 0}
                      variant="outline"
                      className="flex items-center"
                      data-testid="button-previous"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>

                    {/* Question navigation dots */}
                    <div className="flex gap-1">
                      {activeQuestions.slice(0, Math.min(10, activeQuestions.length)).map((_, index) => (
                        <Button
                          key={index}
                          variant={index === currentQuestion ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0 text-xs"
                          onClick={() => setCurrentQuestion(index)}
                          data-testid={`button-question-${index + 1}`}
                        >
                          {currentSection * 10 + index + 1}
                        </Button>
                      ))}
                    </div>

                    <Button
                      onClick={handleNext}
                      className="flex items-center"
                      data-testid="button-next"
                    >
                      {currentQuestion === activeQuestions.length - 1 && currentSection === allSections.length - 1
                        ? "Complete Test"
                        : currentQuestion === activeQuestions.length - 1
                        ? "Next Section"
                        : "Next"}
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
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