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

export default function WritingTest() {
  const { sessionId } = useParams();
  const { session, updateSession } = useTestSession(sessionId);
  const [currentTask, setCurrentTask] = useState(1);
  const [task1Content, setTask1Content] = useState("");
  const [task2Content, setTask2Content] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const { toast } = useToast();

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
      if (currentTask === 2) {
        updateSession({ currentSection: "speaking" });
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
    const content = currentTask === 1 ? task1Content : task2Content;
    const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    const minWords = currentTask === 1 ? 150 : 250;
    
    if (wordCount < minWords) {
      toast({
        title: "Insufficient word count",
        description: `Task ${currentTask} requires at least ${minWords} words. You have ${wordCount} words.`,
        variant: "destructive",
      });
      return;
    }

    setIsEvaluating(true);
    evaluateWritingMutation.mutate({
      candidateText: content,
      prompt: currentTask === 1 ? TASK1_PROMPT : TASK2_PROMPT,
      task: currentTask
    });
  };

  const TASK1_PROMPT = "The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";
  const TASK2_PROMPT = "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university is to give access to knowledge for its own sake. What, in your opinion, should be the main function of a university?";

  if (!session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TestHeader session={session} />
      
      <div className="flex flex-1">
        <TestNavigation currentSection="writing" sessionId={sessionId} />
        
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Task Selection */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <Button
                variant={currentTask === 1 ? "default" : "outline"}
                onClick={() => setCurrentTask(1)}
              >
                Task 1
                <Badge variant="secondary" className="ml-2">20 min</Badge>
              </Button>
              <Button
                variant={currentTask === 2 ? "default" : "outline"}
                onClick={() => setCurrentTask(2)}
              >
                Task 2
                <Badge variant="secondary" className="ml-2">40 min</Badge>
              </Button>
            </div>

            {/* Task Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Writing Task {currentTask}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-900 text-sm">
                    {currentTask === 1 
                      ? "You should spend about 20 minutes on this task. Write at least 150 words."
                      : "You should spend about 40 minutes on this task. Write at least 250 words."
                    }
                  </p>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-slate-900 leading-relaxed">
                    {currentTask === 1 ? TASK1_PROMPT : TASK2_PROMPT}
                  </p>
                </div>

                {currentTask === 1 && (
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
              content={currentTask === 1 ? task1Content : task2Content}
              onChange={currentTask === 1 ? setTask1Content : setTask2Content}
              minWords={currentTask === 1 ? 150 : 250}
              onSubmit={handleSubmitTask}
              isSubmitting={isEvaluating}
              task={currentTask}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
