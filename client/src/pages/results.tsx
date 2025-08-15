import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Award, 
  Headphones, 
  BookOpen, 
  PenTool, 
  Mic,
  Download,
  RotateCcw,
  TrendingUp,
  HomeIcon
} from "lucide-react";

interface SessionData {
  _id: string;
  userId: string;
  testType: string;
  status: string;
  listeningBand?: number;
  readingBand?: number;
  writingBand?: number;
  speakingBand?: number;
  overallBand?: number;
  startTime: string;
  endTime?: string;
}

interface EvaluationData {
  section: string;
  bandScore: number;
  criteria?: any;
  feedback?: string;
}

interface ScoreDebugInfo {
  totalAnswers: number;
  sectionBreakdown: string[];
  listeningScore?: string; // Assuming score is string like "32/40"
  readingScore?: string; // Assuming score is string like "36/40"
}

export default function Results() {
  const { sessionId } = useParams();
  const [, navigate] = useNavigate(); // Use useNavigate for navigation
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<ScoreDebugInfo | null>(null);


  // Fetch session data using useQuery
  const { data: session, isLoading: sessionLoading } = useQuery<SessionData>({
    queryKey: [`/api/sessions/${sessionId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session data: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!sessionId,
    onError: (err: any) => {
      console.error("Error fetching session data:", err);
      setError("Could not load session data. Please try again.");
    }
  });

  // Fetch evaluations using useQuery
  const { data: evaluationsData, isLoading: evaluationsLoading } = useQuery<EvaluationData[]>({
    queryKey: [`/api/sessions/${sessionId}/evaluations`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/sessions/${sessionId}/evaluations`);
      if (!response.ok) {
        throw new Error(`Failed to fetch evaluations: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!sessionId,
    onError: (err: any) => {
      console.error("Error fetching evaluations:", err);
      // Don't set a global error here, as it might not be critical
    }
  });

  // Mutation to calculate scores
  const calculateScoresMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/calculate-scores`);
      if (!response.ok) {
        throw new Error(`Failed to calculate scores: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      console.log('Scores calculated:', data.scores);
      console.log('Debug info:', data.debug);
      setSessionData({ ...session, ...data.scores }); // Update local state with new scores
      setDebugInfo(data.debug);
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}`] }); // Refetch session to ensure UI reflects changes
    },
    onError: (err: any) => {
      console.error("Error calculating scores:", err);
      setError("Could not calculate scores. Please try again.");
    }
  });

  // Effect to trigger score calculation if needed
  useEffect(() => {
    if (session && !sessionLoading) {
      const hasAnyBandScore = session.listeningBand || session.readingBand || session.writingBand || session.speakingBand;
      // If no band scores are present, trigger calculation
      if (!hasAnyBandScore && !calculateScoresMutation.isPending) {
        console.log("No band scores found, calculating based on actual answers...");
        calculateScoresMutation.mutate();
      } else if (session.listeningBand || session.readingBand || session.writingBand || session.speakingBand) {
        // If scores are already present, set them and debug info if available
        setSessionData(session);
        // Try to get debug info from session if it's not already fetched via mutation response
        if (session.debugInfo && !debugInfo) {
            setDebugInfo(session.debugInfo);
        }
      }
    }
  }, [session, sessionLoading, calculateScoresMutation.mutate, debugInfo]);

  // Update evaluations state when evaluations data is loaded
  useEffect(() => {
    if (evaluationsData) {
      setEvaluations(evaluationsData);
    }
  }, [evaluationsData]);

  // Combined loading state
  const isLoading = sessionLoading || evaluationsLoading || calculateScoresMutation.isPending;

  const getBandDescriptor = (band: number): string => {
    const descriptors: { [key: number]: string } = {
      9: 'Expert User',
      8.5: 'Very Good User',
      8: 'Very Good User', 
      7.5: 'Good User',
      7: 'Good User',
      6.5: 'Competent User',
      6: 'Competent User',
      5.5: 'Modest User',
      5: 'Modest User',
      4.5: 'Limited User',
      4: 'Limited User',
      3.5: 'Extremely Limited User',
      3: 'Extremely Limited User',
      2.5: 'Intermittent User',
      2: 'Intermittent User',
      1: 'Non User',
      0: 'Did not attempt'
    };

    return descriptors[band] || 'Unknown';
  };

  const getBandColor = (band: number): string => {
    if (band >= 8) return 'text-green-600';
    if (band >= 7) return 'text-blue-600';
    if (band >= 6) return 'text-purple-600';
    if (band >= 5) return 'text-orange-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error || 'Session data not available'}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              <HomeIcon className="h-4 w-4 mr-2" />
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overallBand = sessionData.overallBand || 0;

  // Calculate actual scores from debug info or use placeholder
  const getActualScore = (section: string) => {
    if (!debugInfo) return 'Not calculated';

    if (section === 'listening') {
      return debugInfo.listeningScore || '0/40';
    } else if (section === 'reading') {
      return debugInfo.readingScore || '0/40';
    }
    return 'AI Evaluated';
  };

  const sections = [
    {
      name: 'Listening',
      icon: Headphones,
      band: sessionData.listeningBand || 0,
      score: getActualScore('listening'),
      color: 'bg-blue-100 text-blue-600'
    },
    {
      name: 'Reading', 
      icon: BookOpen,
      band: sessionData.readingBand || 0,
      score: getActualScore('reading'),
      color: 'bg-green-100 text-green-600'
    },
    {
      name: 'Writing',
      icon: PenTool,
      band: sessionData.writingBand || 0,
      score: 'AI Evaluated',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      name: 'Speaking',
      icon: Mic, 
      band: sessionData.speakingBand || 0,
      score: 'AI Evaluated',
      color: 'bg-red-100 text-red-600'
    }
  ];

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
              <div className={`text-6xl font-bold ${getBandColor(overallBand)} mb-2`}>
                {overallBand.toFixed(1)}
              </div>
              <p className="text-slate-600">{getBandDescriptor(overallBand)}</p>
            </div>

            {/* Individual Scores */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {sections.map((section) => (
                <div key={section.name} className={`text-center p-4 bg-slate-50 rounded-lg`}>
                  <div className={`w-16 h-16 ${section.color} rounded-full flex items-center justify-center mx-auto mb-3`}>
                    <section.icon className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{section.name}</h3>
                  <div className={`text-2xl font-bold ${getBandColor(section.band)} mt-1`}>
                    {section.band.toFixed(1)}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{section.score}</div>
                </div>
              ))}
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
                      {writingEvaluation.criteria.taskAchievement || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Coherence & Cohesion</span>
                    <span className="text-sm font-bold text-purple-600">
                      {writingEvaluation.criteria.coherenceCohesion || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Lexical Resource</span>
                    <span className="text-sm font-bold text-purple-600">
                      {writingEvaluation.criteria.lexicalResource || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Grammar & Accuracy</span>
                    <span className="text-sm font-bold text-purple-600">
                      {writingEvaluation.criteria.grammaticalRange || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">AI Feedback</h4>
                  <p className="text-sm text-blue-800">
                    {writingEvaluation.feedback || "No specific feedback available."}
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
                      {speakingEvaluation.criteria.fluencyCoherence || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-900">Lexical Resource</span>
                    <span className="text-sm font-bold text-red-600">
                      {speakingEvaluation.criteria.lexicalResource || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-900">Grammar & Accuracy</span>
                    <span className="text-sm font-bold text-red-600">
                      {speakingEvaluation.criteria.grammaticalRange || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-900">Pronunciation</span>
                    <span className="text-sm font-bold text-red-600">
                      {speakingEvaluation.criteria.pronunciation || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">AI Feedback</h4>
                  <p className="text-sm text-blue-800">
                    {speakingEvaluation.feedback || "No specific feedback available."}
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
          <Button variant="outline" size="lg" onClick={() => navigate('/')}>
            <RotateCcw className="h-5 w-5 mr-2" />
            Take Another Test
          </Button>
        </div>
      </div>
    </div>
  );
}