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

        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Section Header */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">{sectionTitle}</h1>
                  <p className="text-slate-600 text-lg">Section {currentSection + 1} of 4 • Questions {currentSection * 10 + 1}-{(currentSection + 1) * 10}</p>
                </div>
                <div className="text-right bg-primary/10 rounded-lg p-4">
                  <div className="text-3xl font-bold text-primary">25:30</div>
                  <div className="text-sm text-slate-600 font-medium">Time remaining</div>
                </div>
              </div>

              {/* Section Navigation */}
              <div className="flex gap-3 mb-6">
                {allSections.map((_: any, index: number) => (
                  <Button
                    key={index}
                    variant={index === currentSection ? "default" : "outline"}
                    size="lg"
                    onClick={() => goToSection(index)}
                    data-testid={`button-section-${index + 1}`}
                    className={`px-6 py-3 font-semibold transition-all duration-200 ${
                      index === currentSection 
                        ? "bg-primary hover:bg-primary/90 shadow-md" 
                        : "hover:bg-slate-50 hover:border-primary/50"
                    }`}
                  >
                    Section {index + 1}
                  </Button>
                ))}
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-bold text-blue-900 mb-3 text-lg flex items-center">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm mr-2">i</span>
                  Instructions
                </h3>
                <p className="text-blue-800 leading-relaxed">
                  {sectionInstructions}
                </p>
                {transcript && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-blue-900 font-semibold hover:text-blue-700 transition-colors">View Transcript (for development)</summary>
                    <div className="mt-3 p-4 bg-white rounded-lg border text-sm text-slate-700 whitespace-pre-wrap shadow-sm">
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
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                  <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm mr-3">♪</span>
                  Audio Player
                </h3>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                    <p className="text-amber-800 font-medium">
                      AI is generating your personalized listening test with high-quality audio.
                      This may take a moment...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Panel - Show all questions in current section */}
            {activeQuestions.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Questions List - Main Panel */}
                <div className="xl:col-span-3 space-y-6">
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-slate-900 mb-3">
                        Questions {currentSection * 10 + 1}-{currentSection * 10 + activeQuestions.length}
                      </h3>
                      <p className="text-slate-600 text-lg leading-relaxed">
                        Answer all questions based on what you hear in the audio. You can answer in any order.
                      </p>
                    </div>

                    {/* Display all questions in current section */}
                    <div className="space-y-8">
                      {activeQuestions.map((question: any, index: number) => {
                        const questionNumber = currentSection * 10 + index + 1;
                        const questionText = question?.content?.question || question?.question || '';
                        const isAnswered = !!answers[question._id];
                        
                        // Check if it's a form completion question (has blanks to fill)
                        const isFormCompletion = questionText.includes('_______') || questionText.includes('__________');
                        
                        // Check if it's multiple choice
                        const isMultipleChoice = question?.content?.options && Array.isArray(question.content.options) && question.content.options.length > 0;
                        
                        return (
                          <div key={question._id || index} className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                            isAnswered 
                              ? 'border-green-200 bg-green-50' 
                              : 'border-slate-200 bg-slate-50 hover:border-primary/30'
                          }`}>
                            {/* Form Completion Style */}
                            {isFormCompletion && (
                              <div className="flex items-start space-x-6">
                                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-md">
                                  {questionNumber}
                                </div>
                                <div className="flex-1">
                                  <div 
                                    className="text-slate-800 leading-relaxed text-lg"
                                    dangerouslySetInnerHTML={{
                                      __html: questionText.replace(
                                        /_______+/g,
                                        `<input 
                                          type="text" 
                                          value="${answers[question._id] || ''}"
                                          style="
                                            border: none; 
                                            border-bottom: 2px solid #0891b2; 
                                            background: transparent; 
                                            padding: 2px 8px; 
                                            min-width: 120px; 
                                            font-size: inherit;
                                            outline: none;
                                            margin: 0 4px;
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
                              </div>
                            )}

                            {/* Multiple Choice Style */}
                            {isMultipleChoice && !isFormCompletion && (
                              <div>
                                <div className="flex items-start space-x-6 mb-6">
                                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-md">
                                    {questionNumber}
                                  </div>
                                  <div className="flex-1 text-slate-800 leading-relaxed text-lg font-medium">
                                    {questionText}
                                  </div>
                                </div>
                                
                                <div className="ml-16 space-y-4">
                                  {question.content.options.map((option: string, optIndex: number) => {
                                    const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
                                    const isSelected = answers[question._id] === letter;
                                    
                                    return (
                                      <label key={optIndex} className={`flex items-start space-x-4 cursor-pointer group p-4 rounded-lg transition-all duration-200 ${
                                        isSelected 
                                          ? 'bg-teal-50 border-2 border-teal-200' 
                                          : 'hover:bg-slate-100 border-2 border-transparent'
                                      }`}>
                                        <div className="flex items-center space-x-4">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                                            isSelected 
                                              ? 'bg-teal-500 text-white shadow-md' 
                                              : 'bg-slate-200 text-slate-700 group-hover:bg-slate-300'
                                          }`}>
                                            {letter}
                                          </div>
                                          <div className={`w-6 h-6 border-2 rounded-full transition-all ${
                                            isSelected 
                                              ? 'border-teal-500 bg-teal-500' 
                                              : 'border-slate-300 group-hover:border-teal-300'
                                          }`}>
                                            {isSelected && (
                                              <div className="w-full h-full bg-white rounded-full scale-50"></div>
                                            )}
                                          </div>
                                        </div>
                                        <input
                                          type="radio"
                                          name={`question-${question._id}`}
                                          value={letter}
                                          checked={isSelected}
                                          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                          className="sr-only"
                                        />
                                        <span className="text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors text-lg">
                                          {option}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Fill in the blank style (sentence completion) */}
                            {!isFormCompletion && !isMultipleChoice && (
                              <div>
                                <div className="flex items-start space-x-6 mb-4">
                                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-md">
                                    {questionNumber}
                                  </div>
                                  <div className="flex-1 text-slate-800 leading-relaxed text-lg font-medium">
                                    {questionText}
                                  </div>
                                </div>
                                
                                <div className="ml-16">
                                  <input
                                    type="text"
                                    placeholder="Type your answer here..."
                                    value={answers[question._id] || ''}
                                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                    className="border-2 border-teal-300 bg-white rounded-lg px-4 py-3 min-w-[300px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 text-slate-800 text-lg transition-all"
                                    maxLength={50}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Word limit reminder */}
                            {!isMultipleChoice && (
                              <div className="ml-16 mt-2">
                                <div className="inline-block bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                  <span className="text-sm text-red-700 font-semibold">
                                    ⚠️ Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Progress Panel - Right Sidebar */}
                <div className="space-y-6">
                  {/* Section Progress */}
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                    <h4 className="font-bold text-slate-900 mb-4 text-lg">Test Progress</h4>
                    <div className="space-y-3">
                      {allSections.map((section: any, index: number) => {
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
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                    <h4 className="font-bold text-slate-900 mb-4 text-lg">Navigation</h4>
                    <div className="space-y-3">
                      <Button
                        onClick={handlePrevious}
                        disabled={currentSection === 0}
                        variant="outline"
                        size="lg"
                        className="w-full flex items-center justify-center py-3 text-base font-semibold hover:bg-slate-50 transition-all"
                      >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        Previous Section
                      </Button>
                      
                      <Button
                        onClick={handleNext}
                        size="lg"
                        className="w-full flex items-center justify-center py-3 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md transition-all"
                        disabled={currentSection === allSections.length - 1}
                      >
                        {currentSection === allSections.length - 1 ? "Complete Test" : "Next Section"}
                        <ChevronRight className="h-5 w-5 ml-2" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                    <h4 className="font-bold text-slate-900 mb-4 text-lg">Quick Stats</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Total Questions:</span>
                        <span className="font-bold text-slate-900 text-lg">40</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Current Section:</span>
                        <span className="font-bold text-primary text-lg">{currentSection + 1} of 4</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">Section Questions:</span>
                        <span className="font-bold text-slate-900 text-lg">{activeQuestions.length}</span>
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