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

            {/* Questions Panel - Show all questions in current section */}
            {activeQuestions.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Questions List - Left Panel */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-slate-900">
                        Questions {currentSection * 10 + 1}-{currentSection * 10 + activeQuestions.length}
                      </h3>
                      <p className="text-slate-600 mt-1">
                        Answer all questions based on what you hear in the audio
                      </p>
                    </div>

                    {/* Display all questions in current section */}
                    <div className="space-y-6">
                      {activeQuestions.map((question: any, index: number) => (
                        <div 
                          key={question._id || index}
                          className={`p-4 border rounded-lg transition-colors ${
                            index === currentQuestion 
                              ? 'border-primary bg-primary/5' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                              {currentSection * 10 + index + 1}
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="text-slate-800 font-medium">
                                {question?.content?.question || question?.question}
                              </div>

                              {/* Multiple Choice Options */}
                              {question?.content?.options && Array.isArray(question.content.options) && (
                                <div className="grid grid-cols-1 gap-2">
                                  {question.content.options.map((option: string, optIndex: number) => (
                                    <label key={optIndex} className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-slate-50 transition-colors">
                                      <input
                                        type="radio"
                                        name={`question-${question._id}`}
                                        value={option}
                                        checked={answers[question._id] === option}
                                        onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                        className="w-4 h-4 text-primary border-slate-300 focus:ring-primary"
                                      />
                                      <span className="text-slate-700 text-sm">{option}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {/* Fill in the blank */}
                              {!question?.content?.options && question?.questionType === 'fill_blank' && (
                                <div className="max-w-sm">
                                  <input
                                    type="text"
                                    placeholder="Your answer..."
                                    value={answers[question._id] || ''}
                                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary"
                                    maxLength={50}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">
                                    Write no more than three words and/or a number
                                  </p>
                                </div>
                              )}

                              {/* Answer Status */}
                              {answers[question._id] && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-green-600 font-medium">Answered</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Progress Panel - Right Sidebar */}
                <div className="space-y-4">
                  {/* Section Progress */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Section Progress</h4>
                    <div className="space-y-3">
                      {allSections.map((_, index) => {
                        const sectionAnswered = activeQuestions.filter(q => answers[q._id]).length;
                        const isCurrentSection = index === currentSection;
                        return (
                          <div key={index} className={`p-3 rounded-lg border ${isCurrentSection ? 'border-primary bg-primary/5' : 'border-slate-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${isCurrentSection ? 'text-primary' : 'text-slate-700'}`}>
                                Section {index + 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => goToSection(index)}
                                className="text-xs"
                              >
                                {isCurrentSection ? 'Current' : 'Go to'}
                              </Button>
                            </div>
                            {isCurrentSection && (
                              <div className="mt-2">
                                <div className="flex justify-between text-xs text-slate-600 mb-1">
                                  <span>Progress</span>
                                  <span>{sectionAnswered}/{activeQuestions.length}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${(sectionAnswered / activeQuestions.length) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Navigation Controls */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Navigation</h4>
                    <div className="space-y-2">
                      <Button
                        onClick={handlePrevious}
                        disabled={currentSection === 0}
                        variant="outline"
                        className="w-full flex items-center justify-center"
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Previous Section
                      </Button>
                      
                      <Button
                        onClick={handleNext}
                        className="w-full flex items-center justify-center"
                        disabled={currentSection === allSections.length - 1}
                      >
                        {currentSection === allSections.length - 1 ? "Complete Test" : "Next Section"}
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Quick Stats</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total Questions:</span>
                        <span className="font-medium">40</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Current Section:</span>
                        <span className="font-medium">{currentSection + 1} of 4</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Section Questions:</span>
                        <span className="font-medium">{activeQuestions.length}</span>
                      </div>
                    </div>
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