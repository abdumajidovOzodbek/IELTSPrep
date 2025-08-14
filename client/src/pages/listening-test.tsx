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
    if (sessionId && questionId && answer && answer.toString().trim() !== '') {
      submitAnswerMutation.mutate({
        sessionId: sessionId,
        questionId: questionId,
        answer: answer.toString().trim(),
        section: "listening",
        timeSpent: 30 // Placeholder time
      });
    }
  };

  // Use the properly structured IELTS 4-section format
  console.log("Generated AI Content:", listeningContent);
  console.log("Questions API Response:", questions);

  // Get all 4 sections - prioritize AI content over database
  let allSections = [];
  let activeQuestions = [];
  let currentSectionData = null;
  
  if (listeningContent?.sections && listeningContent.sections.length > 0) {
    // Use AI-generated content
    allSections = listeningContent.sections;
    currentSectionData = allSections[currentSection];
    activeQuestions = currentSectionData?.questions || [];
    console.log("Using AI-generated questions:", activeQuestions.length);
  } else if (questions?.sections && questions.sections.length > 0) {
    // Use database content
    allSections = questions.sections;
    currentSectionData = allSections[currentSection];
    activeQuestions = currentSectionData?.questions || [];
    console.log("Using database questions:", activeQuestions.length);
  }
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

  // Show loading when data is being fetched
  if (isLoading || (isGenerating && (!questions || !questions.sections))) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading test questions...</p>
        {isGenerating && <p className="text-sm text-slate-500 mt-2">Generating personalized content...</p>}
      </div>
    </div>;
  }

  // Show message when no tests are available
  if (!isLoading && (!questions?.sections || questions.sections.length === 0)) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center text-amber-600">
        <p className="text-lg font-medium">No listening tests available</p>
        <p className="text-sm mt-2">Please contact admin to upload test content</p>
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

            {/* Enhanced Audio Player */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">🎧 Audio Player</h3>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <span>Section {currentSection + 1} Audio</span>
                </div>
              </div>
              
              {audioUrl ? (
                <div className="space-y-4">
                  <AudioPlayer
                    audioUrl={audioUrl}
                    isPlaying={isAudioPlaying}
                    onPlayStateChange={setIsAudioPlaying}
                    allowSeeking={true}
                  />
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-600">💡 You can replay the audio multiple times</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAudioPlaying(!isAudioPlaying)}
                        className="flex items-center space-x-1"
                      >
                        {isAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        <span>{isAudioPlaying ? 'Pause' : 'Play'}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                      <div>
                        <p className="text-amber-800 font-medium">Generating Audio Content</p>
                        <p className="text-amber-700 text-sm">AI is creating your personalized listening test. Please wait...</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Questions Panel - Enhanced UI */}
            {activeQuestions.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Questions List - Main Panel */}
                <div className="xl:col-span-3 space-y-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-slate-900">
                        Questions {currentSection * 10 + 1}-{currentSection * 10 + activeQuestions.length}
                      </h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                        <p className="text-blue-800 text-sm font-medium">
                          📝 Instructions: Answer all questions based on what you hear. You can answer in any order.
                        </p>
                        <p className="text-blue-700 text-xs mt-1">
                          💡 Tip: Write exactly what you hear - no more than THREE WORDS AND/OR A NUMBER for fill-in questions.
                        </p>
                      </div>
                    </div>

                    {/* Display questions with improved spacing and clarity */}
                    <div className="space-y-6">
                      {activeQuestions.map((question: any, index: number) => {
                        const questionNumber = currentSection * 10 + index + 1;
                        const isAnswered = !!answers[question._id];
                        
                        return (
                          <div 
                            key={question._id || index}
                            className={`p-5 border-2 rounded-xl transition-all duration-200 ${
                              isAnswered 
                                ? 'border-green-200 bg-green-50' 
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-start space-x-4">
                              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                isAnswered 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {questionNumber}
                              </div>
                              <div className="flex-1 space-y-4">
                                <div className="text-slate-800 font-medium leading-relaxed text-lg">
                                  {question?.content?.question || question?.question}
                                </div>

                                {/* Question Type Indicator */}
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                                    {question.questionType === 'multiple_choice' ? '🔘 Multiple Choice' : 
                                     question.questionType === 'fill_blank' ? '✏️ Fill in the Blank' :
                                     question.questionType === 'short_answer' ? '💬 Short Answer' :
                                     question.questionType === 'sentence_completion' ? '📝 Complete Sentence' :
                                     '❓ Question'}
                                  </span>
                                  {question.wordLimit && (
                                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                                      Limit: {question.wordLimit}
                                    </span>
                                  )}
                                </div>

                                {/* Multiple Choice Options - Enhanced */}
                                {question?.content?.options && Array.isArray(question.content.options) && (
                                  <div className="space-y-3">
                                    {question.content.options.map((option: string, optIndex: number) => {
                                      const isSelected = answers[question._id] === option;
                                      return (
                                        <label 
                                          key={optIndex} 
                                          className={`flex items-start space-x-3 cursor-pointer p-4 rounded-lg transition-all duration-200 border-2 ${
                                            isSelected 
                                              ? 'border-primary bg-primary/5 shadow-sm' 
                                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`question-${question._id}`}
                                            value={option}
                                            checked={isSelected}
                                            onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                            className="w-5 h-5 text-primary border-slate-300 focus:ring-primary mt-0.5"
                                          />
                                          <span className={`leading-relaxed ${isSelected ? 'font-medium text-primary' : 'text-slate-700'}`}>
                                            {option}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Fill in the blank - Enhanced */}
                                {(!question?.content?.options || question?.content?.options?.length === 0) && (
                                  <div className="space-y-3">
                                    <div className="max-w-lg">
                                      <input
                                        type="text"
                                        placeholder="Type your answer here..."
                                        value={answers[question._id] || ''}
                                        onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                        className="w-full p-4 text-lg border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                        maxLength={50}
                                      />
                                      <div className="flex items-center justify-between mt-2">
                                        <p className="text-sm text-slate-500">
                                          💡 Write exactly what you hear
                                        </p>
                                        <p className="text-xs text-orange-600 font-medium">
                                          Max: THREE WORDS AND/OR A NUMBER
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Answer Status - Enhanced */}
                                {isAnswered && (
                                  <div className="flex items-center space-x-2 text-sm p-2 bg-green-100 rounded-lg">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-green-700 font-medium">✓ Answered</span>
                                    <span className="text-green-600 ml-2">"{answers[question._id]}"</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Section Summary */}
                    <div className="mt-8 p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-medium">
                          Section {currentSection + 1} Progress:
                        </span>
                        <span className="text-slate-900 font-bold">
                          {activeQuestions.filter((q: any) => answers[q._id]).length} of {activeQuestions.length} answered
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3 mt-2">
                        <div 
                          className="bg-primary h-3 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${activeQuestions.length > 0 ? 
                              (activeQuestions.filter((q: any) => answers[q._id]).length / activeQuestions.length) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Panel - Right Sidebar */}
                <div className="space-y-4">
                  {/* Section Progress */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Test Progress</h4>
                    <div className="space-y-3">
                      {allSections.map((section, index) => {
                        const sectionQuestions = section?.questions || [];
                        const sectionAnswered = sectionQuestions.filter((q: any) => answers[q._id]).length;
                        const isCurrentSection = index === currentSection;
                        return (
                          <div key={index} className={`p-3 rounded-lg border transition-all ${isCurrentSection ? 'border-primary bg-primary/5' : 'border-slate-200'}`}>
                            <div className="flex items-center justify-between mb-2">
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
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-600">
                                <span>Questions</span>
                                <span>{sectionAnswered}/{sectionQuestions.length}</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${sectionQuestions.length > 0 ? (sectionAnswered / sectionQuestions.length) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
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