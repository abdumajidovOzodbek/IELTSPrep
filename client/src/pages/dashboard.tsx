import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  GraduationCap, 
  Headphones, 
  BookOpen, 
  PenTool, 
  Mic, 
  Clock,
  CheckCircle2,
  Lock,
  Play
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [testType, setTestType] = useState<"academic" | "general">("academic");
  const { toast } = useToast();

  const createSessionMutation = useMutation({
    mutationFn: async (data: { testType: string; userId: string }) => {
      const response = await apiRequest("POST", "/api/sessions", {
        userId: "demo-user", // In real app, would come from auth
        testType: data.testType,
        status: "in_progress",
        currentSection: "listening",
        timeRemaining: 10800 // 3 hours
      });
      return response.json();
    },
    onSuccess: (session) => {
      toast({
        title: "Test session created",
        description: "Starting your IELTS test now...",
      });
      setLocation(`/listening/${session.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create test session. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleStartTest = () => {
    createSessionMutation.mutate({
      testType,
      userId: "demo-user"
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-slate-900">IELTS Test Platform</span>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">Computer Delivered Test</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Welcome to IELTS Test</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Complete all four modules to receive your official IELTS band score. 
            The test will take approximately 2 hours and 45 minutes.
          </p>
        </div>

        {/* Test Selection */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Test Type</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={testType} onValueChange={setTestType as any} className="grid grid-cols-2 gap-6">
              <div className="flex items-center space-x-2 p-4 border border-slate-200 rounded-lg">
                <RadioGroupItem value="academic" id="academic" />
                <Label htmlFor="academic" className="flex-1 cursor-pointer">
                  <div>
                    <div className="font-medium">Academic IELTS</div>
                    <div className="text-sm text-slate-600">For university admission and professional registration</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border border-slate-200 rounded-lg">
                <RadioGroupItem value="general" id="general" />
                <Label htmlFor="general" className="flex-1 cursor-pointer">
                  <div>
                    <div className="font-medium">General Training IELTS</div>
                    <div className="text-sm text-slate-600">For work experience and immigration purposes</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Test Modules Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Headphones className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Listening</h3>
                  <p className="text-sm text-slate-600 mb-3">4 sections • 30 minutes</p>
                  <p className="text-sm text-slate-700 mb-4">
                    Listen to recordings and answer questions about main ideas, specific information, and speaker attitudes.
                  </p>
                  <Badge variant="outline">40 Questions</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Reading</h3>
                  <p className="text-sm text-slate-600 mb-3">3 passages • 60 minutes</p>
                  <p className="text-sm text-slate-700 mb-4">
                    Read passages and answer questions about main ideas, supporting details, and vocabulary.
                  </p>
                  <Badge variant="outline">40 Questions</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <PenTool className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Writing</h3>
                  <p className="text-sm text-slate-600 mb-3">2 tasks • 60 minutes</p>
                  <p className="text-sm text-slate-700 mb-4">
                    Task 1: Describe visual information. Task 2: Write an essay responding to an argument.
                  </p>
                  <Badge variant="outline">2 Tasks</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Mic className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Speaking</h3>
                  <p className="text-sm text-slate-600 mb-3">3 parts • 11-14 minutes</p>
                  <p className="text-sm text-slate-700 mb-4">
                    Speak with an AI examiner about familiar topics, personal experiences, and abstract ideas.
                  </p>
                  <Badge variant="outline">3 Parts</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Instructions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Important Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-slate-900">Time Management</h4>
                <p className="text-sm text-slate-600">
                  Each section has a strict time limit. Plan your time carefully and move on if you're unsure.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-slate-900">AI Evaluation</h4>
                <p className="text-sm text-slate-600">
                  Writing and Speaking sections will be evaluated by advanced AI to provide instant feedback and scoring.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Lock className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-slate-900">Test Security</h4>
                <p className="text-sm text-slate-600">
                  Your test session is secure and monitored. Do not close your browser or navigate away during the test.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start Test Button */}
        <div className="text-center">
          <Button 
            size="lg" 
            onClick={handleStartTest}
            disabled={createSessionMutation.isPending}
            className="px-8 py-3 text-lg"
          >
            {createSessionMutation.isPending ? (
              "Creating Test Session..."
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Start {testType.charAt(0).toUpperCase() + testType.slice(1)} IELTS Test
              </>
            )}
          </Button>
          <p className="text-sm text-slate-600 mt-2">
            Make sure you have a stable internet connection and uninterrupted time.
          </p>
        </div>
      </div>
    </div>
  );
}
