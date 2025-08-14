import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TestHeader from "@/components/test-header";
import TestNavigation from "@/components/test-navigation";
import { useTestSession } from "@/hooks/use-test-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ReadingTest() {
  const { sessionId } = useParams();
  const { session, updateSession } = useTestSession(sessionId);
  const [currentPassage, setCurrentPassage] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Route protection: redirect if user tries to access wrong section
  // Must be at the top to avoid hooks order violation
  useEffect(() => {
    if (session) {
      if (session.currentSection === "listening") {
        // Still on listening, redirect back
        window.location.href = `/test/${sessionId}/listening`;
      } else if (session.currentSection === "writing") {
        // Already moved to writing, redirect to writing
        window.location.href = `/test/${sessionId}/writing`;
      } else if (session.currentSection === "speaking") {
        // Already moved to speaking, redirect to speaking
        window.location.href = `/test/${sessionId}/speaking`;
      } else if (session.currentSection === "completed") {
        // Test completed, redirect to results
        window.location.href = `/results/${sessionId}`;
      }
      // Only allow access if currentSection is "reading"
    }
  }, [session, sessionId]);

  // Get structured reading test data
  const { data, isLoading } = useQuery({
    queryKey: ["/api/questions/reading"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/questions/reading");
      const data = await response.json();
      console.log("Reading test data received:", data);
      return data;
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async (answerData: any) => {
      const response = await apiRequest("POST", "/api/test/submit-answer", answerData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/answers`] });
    },
    onError: (error: any) => {
      console.error("Failed to submit answer:", error);
    }
  });

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    submitAnswerMutation.mutate({
      sessionId,
      questionId,
      answer,
      timeSpent: 0
    });
  };

  const handleNext = () => {
    if (currentQuestion < activeQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else if (currentPassage < allPassages.length - 1) {
      // Move to next passage
      setCurrentPassage(prev => prev + 1);
      setCurrentQuestion(0);
    } else {
      // All reading passages complete, auto-submit and move to writing
      // Submit all remaining answers before progressing
      const unansweredQuestions = allPassages.flatMap((passage: any) => 
        passage.questions?.filter((q: any) => !answers[q._id]) || []
      );

      // Auto-submit blank answers for unanswered questions
      unansweredQuestions.forEach((question: any) => {
        submitAnswerMutation.mutate({
          sessionId: sessionId,
          questionId: question._id,
          answer: "", // Blank answer
          section: "reading",
          timeSpent: 0
        });
      });

      // Update session to writing (this locks reading section)
      updateSession({ 
        currentSection: "writing",
        readingCompleted: true 
      });
      // Note: Navigation will be handled by the updateSession success callback
    }
  };

  const handlePrevious = () => {
    // Only allow going back within the current reading section
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    } else if (currentPassage > 0) {
      setCurrentPassage(prev => prev - 1);
      // Set to last question of previous passage
      const prevPassageQuestions = allPassages[currentPassage - 1]?.questions || [];
      setCurrentQuestion(prevPassageQuestions.length - 1);
    }
    // Cannot go back to listening section
  };

  // Show loading state
  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading reading passages...</p>
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

  // Use structured test data - sort passages by passageNumber
  const allPassages = (data?.passages || []).sort((a: any, b: any) => a.passageNumber - b.passageNumber);
  const currentPassageData = allPassages[currentPassage];
  const activeQuestions = currentPassageData?.questions || [];
  const currentQuestionData = activeQuestions[currentQuestion];
  const passageTitle = currentPassageData?.title || `Passage ${currentPassage + 1}`;
  const passageText = currentPassageData?.passage || currentPassageData?.text || "";
  const instructions = currentPassageData?.instructions || "Read the passage and answer the questions.";
  const testTitle = data?.testTitle || "Reading Test";

  console.log("Current passage:", currentPassage, "Total passages:", allPassages.length);
  console.log("Current passage data:", currentPassageData?.title);
  console.log("Active questions:", activeQuestions.length);
  console.log("Current question data:", currentQuestionData);

  const renderQuestion = () => {
    if (!currentQuestionData) {
      return <div className="text-center text-slate-600 py-8">No questions available</div>;
    }

    const { questionType, content, question, options, correctAnswer } = currentQuestionData;

    switch (questionType) {
      case "multiple_choice":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{question || content?.question}</h3>
            <RadioGroup
              value={answers[currentQuestionData._id] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestionData._id, value)}
            >
              {(options || content?.options || []).map((option: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="cursor-pointer flex-1">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "true_false":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{question || content?.question}</h3>
            <RadioGroup
              value={answers[currentQuestionData._id] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestionData._id, value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="TRUE" id="true" />
                <Label htmlFor="true" className="cursor-pointer">TRUE</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FALSE" id="false" />
                <Label htmlFor="false" className="cursor-pointer">FALSE</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NOT GIVEN" id="notgiven" />
                <Label htmlFor="notgiven" className="cursor-pointer">NOT GIVEN</Label>
              </div>
            </RadioGroup>
          </div>
        );

      case "fill_blank":
      case "short_answer":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{question || content?.question}</h3>
            <Input
              value={answers[currentQuestionData._id] || ""}
              onChange={(e) => handleAnswerChange(currentQuestionData._id, e.target.value)}
              placeholder="Enter your answer"
              className="w-full"
            />
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{question || content?.question}</h3>
            <Input
              value={answers[currentQuestionData._id] || ""}
              onChange={(e) => handleAnswerChange(currentQuestionData._id, e.target.value)}
              placeholder="Enter your answer"
              className="w-full"
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <TestHeader session={session} />

      <div className="flex flex-1">
        <TestNavigation currentSection="reading" sessionId={sessionId || ""} />

        <main className="flex-1 p-4 ml-64">
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Compact Section Header */}
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">Reading Test</h1>
                  <p className="text-slate-600">
                    {passageTitle} • Question {currentQuestion + 1} of {activeQuestions.length}
                  </p>
                </div>
                <div className="text-right bg-primary/10 rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">45:30</div>
                  <div className="text-xs text-slate-600 font-medium">Time left</div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h3 className="font-semibold text-blue-900 mb-2 text-sm">Instructions</h3>
                <p className="text-blue-800 text-xs">{instructions}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Reading Passage */}
              <Card className="h-fit">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-slate-900">{passageTitle}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-96 pr-4">
                    <div className="text-slate-900 leading-relaxed space-y-4 text-sm">
                      {passageText.split('\n\n').map((paragraph: string, index: number) => (
                        <p key={index} className="text-justify">{paragraph}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Questions */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-slate-900">
                      Question {currentQuestion + 1}
                    </CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <span>{currentPassage + 1}/3 Passages</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="min-h-64">
                    {renderQuestion()}
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentQuestion === 0 && currentPassage === 0}
                      size="sm"
                      className="flex items-center"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <div className="text-sm text-slate-600">
                      Question {currentQuestion + 1} of {activeQuestions.length}
                    </div>

                    <Button
                      onClick={handleNext}
                      size="sm"
                      className="flex items-center bg-primary hover:bg-primary/90"
                    >
                      {currentPassage === allPassages.length - 1 && currentQuestion === activeQuestions.length - 1
                        ? "Complete Reading"
                        : "Next"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}