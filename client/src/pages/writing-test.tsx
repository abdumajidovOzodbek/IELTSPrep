import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TestHeader from "@/components/test-header";
import TestNavigation from "@/components/test-navigation";
import WritingEditor from "@/components/writing-editor";
import { useTestSession } from "@/hooks/use-test-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function WritingTest() {
  const { sessionId } = useParams();
  const { session, updateSession } = useTestSession(sessionId);
  const [currentTask, setCurrentTask] = useState(0); // Start with task 0 for consistency with array indexing
  const [task1Content, setTask1Content] = useState("");
  const [task2Content, setTask2Content] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const { toast } = useToast();

  // Store answers in a state object
  const [answers, setAnswers] = useState({});

  // Function to handle changes in the editor and update the answers state
  const handleEditorChange = (content: string, taskNumber: number) => {
    setAnswers(prev => ({ ...prev, [`task_${taskNumber}`]: content }));
    if (taskNumber === 1) {
      setTask1Content(content);
    } else {
      setTask2Content(content);
    }
  };

  const submitAnswerMutation = useMutation({
    mutationFn: async (data: { sessionId: string; questionId: string; answer: string; section: string; timeSpent: number }) => {
      return apiRequest("POST", "/api/test/submit-answer", data);
    },
    onSuccess: (data, variables) => {
      console.log(`Answer submitted successfully for ${variables.questionId}`);
    },
    onError: (error) => {
      console.error("Failed to submit answer:", error);
      toast({
        title: "Submission failed",
        description: "Your answer could not be saved. Please try again.",
        variant: "destructive",
      });
    }
  });

  const evaluateWritingMutation = useMutation({
    mutationFn: async (data: { candidateText: string; prompt: string; task: number }) => {
      const response = await apiRequest("POST", "/api/ai/evaluate/writing", {
        sessionId,
        candidateText: data.candidateText,
        prompt: data.prompt,
        questionId: `writing-task-${data.task}`
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Writing evaluated successfully",
        description: `Overall band: ${data.result.overallWritingBand}`,
      });
      setIsEvaluating(false);

      // Update session to next section if both tasks complete
      if (currentTask === 1) { // If current task was the last one (task 2)
        updateSession({ currentSection: "speaking", writingCompleted: true });
      }
    },
    onError: () => {
      toast({
        title: "Evaluation failed",
        description: "Please try submitting again.",
        variant: "destructive",
      });
      setIsEvaluating(false);
    }
  });

  const handleSubmitTask = async () => {
    const content = currentTask === 0 ? task1Content : task2Content;
    const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    const minWords = currentTask === 0 ? 150 : 250;

    if (wordCount < minWords) {
      toast({
        title: "Insufficient word count",
        description: `Task ${currentTask + 1} requires at least ${minWords} words. You have ${wordCount} words.`,
        variant: "destructive",
      });
      return;
    }

    setIsEvaluating(true);
    evaluateWritingMutation.mutate({
      candidateText: content,
      prompt: currentTask === 0 ? TASK1_PROMPT : TASK2_PROMPT,
      task: currentTask + 1 // Task number for the API
    });
  };

  const handleNextTask = () => {
    if (currentTask === 0) {
      // Auto-submit current task before moving to next
      if (answers[`task_${currentTask + 1}`]?.trim()) {
        submitAnswerMutation.mutate({
          sessionId: sessionId,
          questionId: `writing_task_${currentTask + 1}`,
          answer: answers[`task_${currentTask + 1}`],
          section: "writing",
          timeSpent: 0
        });
      }
      setCurrentTask(1);
    } else {
      // Complete writing test - auto-submit all tasks
      Object.keys(answers).forEach(taskId => {
        if (answers[taskId]?.trim()) {
          submitAnswerMutation.mutate({
            sessionId: sessionId,
            questionId: `writing_${taskId}`,
            answer: answers[taskId],
            section: "writing",
            timeSpent: 0
          });
        }
      });

      // Update session to speaking (this locks writing section)
      updateSession({
        currentSection: "speaking",
        writingCompleted: true
      });
      window.location.href = `/test/${sessionId}/speaking`;
    }
  };

  const TASK1_PROMPT = "The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";
  const TASK2_PROMPT = "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university is to give access to knowledge for its own sake. What, in your opinion, should be the main function of a university?";

  useEffect(() => {
    // If the session indicates we should be in speaking or beyond, redirect
    if (session && session.currentSection === "speaking" && !session.writingCompleted) {
      updateSession({ currentSection: "speaking", writingCompleted: true });
      window.location.href = `/test/${sessionId}/speaking`;
    } else if (session && session.currentSection === "reading") {
       // If somehow we land on writing but session is already on reading, redirect
       window.location.href = `/test/${sessionId}/reading`;
    }
  }, [session, sessionId, updateSession]);


  if (!session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  // If the session is already in the speaking section, redirect
  if (session.currentSection === "speaking" || session.currentSection === "reading") {
    // The useEffect above should handle this, but as a safeguard:
    if (session.currentSection === "speaking") window.location.href = `/test/${sessionId}/speaking`;
    if (session.currentSection === "reading") window.location.href = `/test/${sessionId}/reading`;
    return null; // Prevent rendering anything if redirecting
  }


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TestHeader session={session} />

      <div className="flex flex-1">
        <TestNavigation currentSection="writing" sessionId={sessionId} />

        <main className="flex-1 p-6 ml-64">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Task Selection */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <Button
                variant={currentTask === 0 ? "default" : "outline"}
                onClick={() => setCurrentTask(0)}
                disabled={currentTask === 1} // Disable Task 1 if already on Task 2
              >
                Task 1
                <Badge variant="secondary" className="ml-2">20 min</Badge>
              </Button>
              <Button
                variant={currentTask === 1 ? "default" : "outline"}
                onClick={() => setCurrentTask(1)}
                disabled={currentTask === 0 && !answers[`task_1`]} // Disable Task 2 until Task 1 is at least started/saved
              >
                Task 2
                <Badge variant="secondary" className="ml-2">40 min</Badge>
              </Button>
            </div>

            {/* Task Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Writing Task {currentTask + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-900 text-sm">
                    {currentTask === 0
                      ? "You should spend about 20 minutes on this task. Write at least 150 words."
                      : "You should spend about 40 minutes on this task. Write at least 250 words."
                    }
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-slate-900 leading-relaxed">
                    {currentTask === 0 ? TASK1_PROMPT : TASK2_PROMPT}
                  </p>
                </div>

                {currentTask === 0 && (
                  <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50 text-center">
                    <img
                      src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
                      alt="Housing statistics chart"
                      className="mx-auto rounded-lg shadow-sm"
                    />
                    <p className="text-sm text-slate-600 mt-2">Chart: Housing accommodation types in England and Wales (1918-2011)</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Writing Editor */}
            <WritingEditor
              content={currentTask === 0 ? task1Content : task2Content}
              onChange={(content) => handleEditorChange(content, currentTask + 1)}
              minWords={currentTask === 0 ? 150 : 250}
              onSubmit={handleSubmitTask}
              isSubmitting={isEvaluating}
              task={currentTask + 1}
            />
          </div>
        </main>
      </div>

      {/* Footer with navigation */}
      <div className="bg-white border-t border-slate-200 p-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentTask(0)}
            disabled={currentTask === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous Task
          </Button>

          <div className="text-sm text-slate-600">
            Task {currentTask + 1} of 2
          </div>

          <Button
            onClick={handleNextTask}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            {currentTask === 0 ? "Complete Writing" : "Next Section"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}