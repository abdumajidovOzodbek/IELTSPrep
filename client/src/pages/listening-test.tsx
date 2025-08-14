import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TestHeader from "@/components/test-header";
import TestNavigation from "@/components/test-navigation";
import AudioPlayer from "@/components/audio-player";
import { useTestSession } from "@/hooks/use-test-session";
import { ListeningTest } from "@/components/ListeningTest";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";

export default function ListeningTestPage() {
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

  // Enhanced authentic IELTS test format is now ready

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <TestHeader session={session} />

      <div className="flex flex-1">
        <TestNavigation currentSection="listening" sessionId={sessionId || ""} />

        <main className="flex-1 p-4">
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Compact Section Header */}
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">{sectionTitle}</h1>
                  <p className="text-slate-600">Section {currentSection + 1} of 4 • Questions {currentSection * 10 + 1}-{(currentSection + 1) * 10}</p>
                </div>
                <div className="text-right bg-primary/10 rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">25:30</div>
                  <div className="text-xs text-slate-600 font-medium">Time left</div>
                </div>
              </div>

              {/* Compact Section Navigation */}
              <div className="flex gap-2 mb-4">
                {allSections.map((_: any, index: number) => (
                  <Button
                    key={index}
                    variant={index === currentSection ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToSection(index)}
                    data-testid={`button-section-${index + 1}`}
                    className={`px-4 py-2 text-sm font-semibold transition-all ${
                      index === currentSection 
                        ? "bg-primary hover:bg-primary/90" 
                        : "hover:bg-slate-50 hover:border-primary/50"
                    }`}
                  >
                    Section {index + 1}
                  </Button>
                ))}
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mr-2">i</span>
                  Instructions
                </h3>
                <p className="text-blue-800 text-sm leading-relaxed">
                  {sectionInstructions}
                </p>
                {transcript && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-blue-900 font-semibold hover:text-blue-700 transition-colors text-sm">View Transcript (for development)</summary>
                    <div className="mt-2 p-3 bg-white rounded border text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {transcript}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {audioUrl ? (
              <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
                <AudioPlayer
                  audioUrl={audioUrl}
                  isPlaying={false}
                  onPlayStateChange={() => {}}
                  allowSeeking={false}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mr-2">♪</span>
                  Audio Player
                </h3>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>
                    <p className="text-amber-800 text-sm">
                      Generating audio content...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Panel - Compact Grid Layout */}
            {activeQuestions.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                {/* Questions List - Main Panel */}
                <div className="xl:col-span-3">
                  <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Questions {currentSection * 10 + 1}-{currentSection * 10 + activeQuestions.length}
                      </h3>
                      <p className="text-slate-600 text-sm">
                        Answer all questions based on what you hear in the audio.
                      </p>
                    </div>

                    {/* Compact Grid Layout for Questions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeQuestions.map((question: any, index: number) => {
                        const questionNumber = currentSection * 10 + index + 1;
                        const questionText = question?.content?.question || question?.question || '';
                        const isAnswered = !!answers[question._id];
                        
                        // Check if it's a form completion question (has blanks to fill)
                        const isFormCompletion = questionText.includes('_______') || questionText.includes('__________');
                        
                        // Check if it's multiple choice
                        const isMultipleChoice = question?.content?.options && Array.isArray(question.content.options) && question.content.options.length > 0;
                        
                        return (
                          <div key={question._id || index} className={`p-3 rounded-lg border transition-all duration-200 ${
                            isAnswered 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-slate-200 bg-slate-50 hover:border-primary/40'
                          }`}>
                            {/* Form Completion Style - Compact */}
                            {isFormCompletion && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <div className="flex-shrink-0 w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                    {questionNumber}
                                  </div>
                                  <span className="text-xs text-slate-500 font-medium">Form Completion</span>
                                </div>
                                <div 
                                  className="text-slate-800 text-sm leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: questionText.replace(
                                      /_______+/g,
                                      `<input 
                                        type="text" 
                                        value="${answers[question._id] || ''}"
                                        style="
                                          border: 1px solid #0891b2; 
                                          background: white; 
                                          padding: 4px 6px; 
                                          min-width: 80px; 
                                          font-size: 12px;
                                          outline: none;
                                          margin: 0 2px;
                                          border-radius: 4px;
                                        "
                                        placeholder="..."
                                        onchange="this.dispatchEvent(new CustomEvent('answer-change', {detail: {questionId: '${question._id}', value: this.value}}))"
                                      />`
                                    )
                                  }}
                                  onInput={(e: any) => {
                                    if (e.target.tagName === 'INPUT') {
                                      handleAnswerChange(question._id, e.target.value);
                                    }
                                  }}
                                />
                              </div>
                            )}

                            {/* Multiple Choice Style - Compact */}
                            {isMultipleChoice && !isFormCompletion && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2 mb-2">
                                  <div className="flex-shrink-0 w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                    {questionNumber}
                                  </div>
                                  <span className="text-xs text-slate-500 font-medium">Multiple Choice</span>
                                </div>
                                <p className="text-slate-800 text-sm font-medium mb-2">{questionText}</p>
                                
                                <div className="space-y-1">
                                  {question.content.options.map((option: string, optIndex: number) => {
                                    const letter = String.fromCharCode(65 + optIndex);
                                    const isSelected = answers[question._id] === letter;
                                    
                                    return (
                                      <label key={optIndex} className={`flex items-center space-x-2 cursor-pointer p-2 rounded transition-all ${
                                        isSelected 
                                          ? 'bg-teal-100 border border-teal-300' 
                                          : 'hover:bg-slate-100'
                                      }`}>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                          isSelected 
                                            ? 'bg-teal-500 text-white' 
                                            : 'bg-slate-200 text-slate-600'
                                        }`}>
                                          {letter}
                                        </div>
                                        <input
                                          type="radio"
                                          name={`question-${question._id}`}
                                          value={letter}
                                          checked={isSelected}
                                          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                          className="sr-only"
                                        />
                                        <span className="text-slate-700 text-xs leading-relaxed flex-1">
                                          {option}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Fill in the blank style - Compact */}
                            {!isFormCompletion && !isMultipleChoice && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <div className="flex-shrink-0 w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                    {questionNumber}
                                  </div>
                                  <span className="text-xs text-slate-500 font-medium">Short Answer</span>
                                </div>
                                <p className="text-slate-800 text-sm font-medium">{questionText}</p>
                                <input
                                  type="text"
                                  placeholder="Your answer..."
                                  value={answers[question._id] || ''}
                                  onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                  className="w-full border border-teal-300 bg-white rounded px-2 py-1 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                                  maxLength={50}
                                />
                              </div>
                            )}

                            {/* Compact Word limit reminder */}
                            {!isMultipleChoice && (
                              <div className="mt-1">
                                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                  Max: 3 words/numbers
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Compact Progress Panel - Right Sidebar */}
                <div className="space-y-4">
                  {/* Section Progress */}
                  <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
                    <h4 className="font-bold text-slate-900 mb-3 text-base">Progress</h4>
                    <div className="space-y-2">
                      {allSections.map((section: any, index: number) => {
                        const sectionQuestions = section?.questions || [];
                        const sectionAnswered = sectionQuestions.filter((q: any) => answers[q._id]).length;
                        const isCurrentSection = index === currentSection;
                        return (
                          <div key={index} className={`p-2 rounded border transition-all ${isCurrentSection ? 'border-primary bg-primary/5' : 'border-slate-200'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-medium ${isCurrentSection ? 'text-primary' : 'text-slate-700'}`}>
                                Section {index + 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => goToSection(index)}
                                className="text-xs h-6 px-2"
                              >
                                {isCurrentSection ? 'Current' : 'Go'}
                              </Button>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 mb-1">
                              <span>Questions</span>
                              <span>{sectionAnswered}/{sectionQuestions.length}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                              <div 
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${sectionQuestions.length > 0 ? (sectionAnswered / sectionQuestions.length) * 100 : 0}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Compact Navigation Controls */}
                  <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
                    <h4 className="font-bold text-slate-900 mb-3 text-base">Navigation</h4>
                    <div className="space-y-2">
                      <Button
                        onClick={handlePrevious}
                        disabled={currentSection === 0}
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center py-2 text-sm hover:bg-slate-50"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      
                      <Button
                        onClick={handleNext}
                        size="sm"
                        className="w-full flex items-center justify-center py-2 text-sm bg-primary hover:bg-primary/90"
                        disabled={currentSection === allSections.length - 1}
                      >
                        {currentSection === allSections.length - 1 ? "Complete" : "Next"}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Compact Quick Stats */}
                  <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
                    <h4 className="font-bold text-slate-900 mb-3 text-base">Stats</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Total:</span>
                        <span className="font-bold text-slate-900">40</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Section:</span>
                        <span className="font-bold text-primary">{currentSection + 1}/4</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Questions:</span>
                        <span className="font-bold text-slate-900">{activeQuestions.length}</span>
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