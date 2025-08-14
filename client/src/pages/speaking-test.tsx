import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TestHeader from "@/components/test-header";
import TestNavigation from "@/components/test-navigation";
import SpeakingRecorder from "@/components/speaking-recorder";
import { useTestSession } from "@/hooks/use-test-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Volume2 } from "lucide-react";

export default function SpeakingTest() {
  const { sessionId } = useParams();
  const { session, updateSession } = useTestSession(sessionId);
  const [currentPart, setCurrentPart] = useState(2);
  const [preparationTime, setPreparationTime] = useState(60);
  const [notes, setNotes] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [responses, setResponses] = useState({}); // State to store responses for each part

  // Mutation to submit individual answers (used for speaking parts)
  const submitAnswerMutation = useMutation({
    mutationFn: async (data: { sessionId: string; questionId: string; answer: string; section: string; timeSpent: number }) => {
      const response = await apiRequest("POST", "/api/test/submit-answer", data);
      return response.json();
    },
    onSuccess: (data, variables) => {
      console.log(`Answer submitted for ${variables.questionId}:`, data);
      // Update session state to reflect progress if needed
      // For speaking, progress is implicitly handled by completing the section
    }
  });

  const evaluateSpeakingMutation = useMutation({
    mutationFn: async (data: { transcript: string }) => {
      const response = await apiRequest("POST", "/api/ai/evaluate/speaking", {
        sessionId,
        transcript: data.transcript,
        audioFeatures: {} // Would include audio analysis
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Speaking evaluation:", data);
      // Move to results
      updateSession({ 
        currentSection: "completed",
        status: "completed" 
      });
    }
  });

  useEffect(() => {
    if (preparationTime > 0) {
      const timer = setTimeout(() => {
        setPreparationTime(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [preparationTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to handle moving to the next part (and auto-submitting current)
  const handleNextPart = () => {
    if (session && session.currentSection === "speaking") {
      // Assuming 'speaking' section has only one part for simplicity in this example
      // In a real scenario, you'd iterate through parts
      const currentSpeakingPartId = "1"; // Example part ID

      // Find the current speaking response to submit
      const currentSpeakingResponse = Object.values(responses).find(res => res.partId === currentSpeakingPartId);

      if (currentSpeakingResponse && currentSpeakingResponse.audioBlob) {
        submitAnswerMutation.mutate({
          sessionId: sessionId,
          questionId: `speaking_${currentSpeakingPartId}`,
          answer: `Audio response for part ${currentSpeakingPartId}`, // Placeholder, actual audio submission would be different
          section: "speaking",
          timeSpent: 0 // This would need to be tracked
        });
      }
    }

    // Logic to move to the next section (or complete the test)
    // This part needs to be more dynamic based on the actual test structure
    // For now, let's assume speaking is the last part or we are moving to a hypothetical 'next' section
    updateSession({ 
      currentSection: "completed", // This should ideally transition to the next logical section or results
      speakingCompleted: true // Mark speaking as completed
    });
    window.location.href = `/results/${sessionId}`; // Redirect to results
  };

  // Route protection: redirect if user tries to access wrong section
  useEffect(() => {
    if (session) {
      if (session.currentSection === "listening") {
        // Still on listening, redirect back
        window.location.href = `/test/${sessionId}/listening`;
      } else if (session.currentSection === "reading") {
        // Still on reading, redirect back
        window.location.href = `/test/${sessionId}/reading`;
      } else if (session.currentSection === "writing") {
        // Still on writing, redirect back
        window.location.href = `/test/${sessionId}/writing`;
      } else if (session.currentSection === "completed") {
        // Test completed, redirect to results
        window.location.href = `/results/${sessionId}`;
      }
      // Only allow access if currentSection is "speaking"
    }
  }, [session, sessionId]);

  // Determine if the user can navigate back (only if not in speaking or speaking is not yet completed)
  const canGoBack = session ? (session.currentSection !== "speaking" || !session.speakingCompleted) : false;


  if (!session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading session...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TestHeader session={session} />

      <div className="flex flex-1">
        {/* Pass canGoBack prop to TestNavigation */}
        <TestNavigation currentSection={session.currentSection} sessionId={sessionId} canGoBack={canGoBack} />

        <main className="flex-1 p-6 ml-64">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Section Header */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Speaking Test</h1>
                  <p className="text-slate-600 mt-1">Part 2 • Individual Long Turn</p>
                </div>
                {/* Only show preparation time if it's still counting down */}
                {preparationTime > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{formatTime(preparationTime)}</div>
                    <div className="text-sm text-slate-600">Preparation time</div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Examiner */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">AI Examiner</h3>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 mb-4">
                      <p className="text-slate-900">
                        I'm going to give you a topic and I'd like you to talk about it for one to two minutes. 
                        Before you talk, you'll have one minute to think about what you're going to say. 
                        You can make some notes if you wish.
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Volume2 className="h-4 w-4 mr-2" />
                      Replay instructions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Topic Card */}
            {session.currentSection === "speaking" && preparationTime === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Topic</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6">
                    <h4 className="font-semibold text-yellow-900 mb-3">
                      Describe a place you visited that was particularly memorable.
                    </h4>
                    <p className="text-yellow-800 mb-4">You should say:</p>
                    <ul className="text-yellow-800 space-y-2 ml-4">
                      <li>• where this place was</li>
                      <li>• when you visited it</li>
                      <li>• what you did there</li>
                      <li>• and explain why it was so memorable for you</li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium text-slate-900 mb-2">Your Notes (optional)</h4>
                    <Textarea
                      className="h-32"
                      placeholder="You can write notes here to help prepare your answer..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recording Interface */}
            {session.currentSection === "speaking" && (
              <SpeakingRecorder
                isRecording={isRecording}
                onStartRecording={() => setIsRecording(true)}
                onStopRecording={(transcript, audioBlob) => {
                  setIsRecording(false);
                  // Store the response with audioBlob
                  setResponses(prev => ({ ...prev, 1: { transcript, audioBlob } })); // Assuming part 1
                  // Optionally, evaluate immediately or wait for user to click complete
                  // evaluateSpeakingMutation.mutate({ transcript }); 
                }}
                preparationComplete={preparationTime === 0}
              />
            )}

            {/* Navigation Button */}
            {session.currentSection === "speaking" && (
              <div className="text-right">
                <Button
                  onClick={() => {
                    // Auto-submit all speaking responses
                    Object.keys(responses).forEach(partId => {
                      if (responses[partId]?.audioBlob) {
                        // Submit speaking response (would need audio handling in real implementation)
                        submitAnswerMutation.mutate({
                          sessionId: sessionId,
                          questionId: `speaking_${partId}`,
                          answer: `Audio response for ${partId}`,
                          section: "speaking",
                          timeSpent: 0
                        });
                      }
                    });

                    // Complete the entire test
                    updateSession({ 
                      currentSection: "completed",
                      speakingCompleted: true 
                    });
                    window.location.href = `/results/${sessionId}`;
                  }}
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                >
                  Complete Test
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}