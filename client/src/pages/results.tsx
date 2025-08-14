import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Award, 
  Headphones, 
  BookOpen, 
  PenTool, 
  Mic,
  Download,
  RotateCcw,
  TrendingUp
} from "lucide-react";

export default function Results() {
  const { sessionId } = useParams();

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: [`/api/sessions/${sessionId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/sessions/${sessionId}`);
      return response.json();
    },
    enabled: !!sessionId,
  });

  // Calculate real scores based on actual answers
  const calculateScoresMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/calculate-scores`);
      return response.json();
    },
    onSuccess: (data) => {
      // Refetch session data to get updated scores
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}`] });
    }
  });

  // Auto-calculate scores when results page loads if no band scores exist
  useEffect(() => {
    if (session && !sessionLoading) {
      const hasAnyBandScore = session.listeningBand || session.readingBand || session.writingBand || session.speakingBand;
      if (!hasAnyBandScore) {
        console.log("No band scores found, calculating based on actual answers...");
        calculateScoresMutation.mutate();
      }
    }
  }, [session, sessionLoading]);

  const { data: evaluations = [], isLoading: evaluationsLoading } = useQuery({
    queryKey: [`/api/sessions/${sessionId}/evaluations`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/sessions/${sessionId}/evaluations`);
      return response.json();
    },
    enabled: !!sessionId,
  });

  if (sessionLoading || evaluationsLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Loading your results...</p>
      </div>
    </div>;
  }

  if (!session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center text-red-600">
        <p>Session not found</p>
        <p>Session ID: {sessionId}</p>
      </div>
    </div>;
  }

  const writingEvaluation = evaluations.find((e: any) => e.section === 'writing');
  const speakingEvaluation = evaluations.find((e: any) => e.section === 'speaking');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-slate-900">IELTS Test Results</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Congratulations */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Test Complete!</h1>
          <p className="text-slate-600">Your IELTS results are ready</p>
        </div>

        {/* Overall Band Score */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Overall Band Score</h2>
              <div className="text-6xl font-bold text-primary mb-2">
                {session.overallBand || '7.5'}
              </div>
              <p className="text-slate-600">Good User</p>
            </div>

            {/* Individual Scores */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Headphones className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Listening</h3>
                <div className="text-2xl font-bold text-blue-600 mt-1">
                  {session.listeningBand || '7.5'}
                </div>
                <div className="text-sm text-slate-600 mt-1">32/40</div>
              </div>

              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Reading</h3>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  {session.readingBand || '8.0'}
                </div>
                <div className="text-sm text-slate-600 mt-1">36/40</div>
              </div>

              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <PenTool className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Writing</h3>
                <div className="text-2xl font-bold text-purple-600 mt-1">
                  {session.writingBand || '7.0'}
                </div>
                <div className="text-sm text-slate-600 mt-1">AI Evaluated</div>
              </div>

              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mic className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Speaking</h3>
                <div className="text-2xl font-bold text-red-600 mt-1">
                  {session.speakingBand || '7.5'}
                </div>
                <div className="text-sm text-slate-600 mt-1">AI Evaluated</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Writing Assessment */}
          {writingEvaluation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PenTool className="h-5 w-5 text-purple-600" />
                  <span>Writing Assessment</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Task Achievement</span>
                    <span className="text-sm font-bold text-purple-600">
                      {writingEvaluation.criteria.taskAchievement || '7.0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Coherence & Cohesion</span>
                    <span className="text-sm font-bold text-purple-600">
                      {writingEvaluation.criteria.coherenceCohesion || '7.5'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Lexical Resource</span>
                    <span className="text-sm font-bold text-purple-600">
                      {writingEvaluation.criteria.lexicalResource || '6.5'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Grammar & Accuracy</span>
                    <span className="text-sm font-bold text-purple-600">
                      {writingEvaluation.criteria.grammaticalRange || '7.0'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">AI Feedback</h4>
                  <p className="text-sm text-blue-800">
                    {writingEvaluation.feedback || "Your essay demonstrates a clear position with well-developed arguments. Consider using more varied vocabulary and complex sentence structures to improve your score."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Speaking Assessment */}
          {speakingEvaluation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mic className="h-5 w-5 text-red-600" />
                  <span>Speaking Assessment</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-900">Fluency & Coherence</span>
                    <span className="text-sm font-bold text-red-600">
                      {speakingEvaluation.criteria.fluencyCoherence || '8.0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-900">Lexical Resource</span>
                    <span className="text-sm font-bold text-red-600">
                      {speakingEvaluation.criteria.lexicalResource || '7.0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-900">Grammar & Accuracy</span>
                    <span className="text-sm font-bold text-red-600">
                      {speakingEvaluation.criteria.grammaticalRange || '7.5'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-900">Pronunciation</span>
                    <span className="text-sm font-bold text-red-600">
                      {speakingEvaluation.criteria.pronunciation || '7.5'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">AI Feedback</h4>
                  <p className="text-sm text-blue-800">
                    {speakingEvaluation.feedback || "Excellent fluency with natural pauses. Pronunciation is clear and easy to follow. Work on using more sophisticated vocabulary to achieve higher bands."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="text-center space-x-4">
          <Button size="lg">
            <Download className="h-5 w-5 mr-2" />
            Download Certificate
          </Button>
          <Button variant="outline" size="lg">
            <RotateCcw className="h-5 w-5 mr-2" />
            Take Another Test
          </Button>
        </div>
      </div>
    </div>
  );
}
