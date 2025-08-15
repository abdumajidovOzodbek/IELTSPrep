
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  ClipboardList, 
  Bot, 
  TrendingUp,
  Eye,
  Download,
  Filter,
  Plus,
  Upload,
  Music,
  FileAudio,
  Sparkles
} from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(1);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [newTestData, setNewTestData] = useState({
    title: "",
    description: "",
    difficulty: "intermediate"
  });
  const [sectionData, setSectionData] = useState({
    sectionTitle: "",
    instructions: ""
  });

  const [passageData, setPassageData] = useState({
    title: "",
    content: "",
    instructions: ""
  });

  const { data: stats } = useQuery<{ audioFiles?: number }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/sessions"],
  });

  const { data: audioFiles = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/audio/list"],
  });

  const { data: listeningTests = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/listening-tests"],
  });

  const { data: readingTests = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/reading-tests"],
  });

  // Upload audio file mutation
  const uploadAudioMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("uploadedBy", "admin");

      const response = await fetch("/api/admin/audio/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Audio file uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audio/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedFile(null);
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  // Create listening test mutation
  const createTestMutation = useMutation({
    mutationFn: async (testData: any) => {
      const response = await apiRequest("POST", "/api/admin/listening-tests", testData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test Created",
        description: "Listening test created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listening-tests"] });
      setNewTestData({ title: "", description: "", difficulty: "intermediate" });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload section audio mutation
  const uploadSectionAudioMutation = useMutation({
    mutationFn: async ({ testId, sectionNumber, file, sectionTitle, instructions }: any) => {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("sectionTitle", sectionTitle);
      formData.append("instructions", instructions);
      formData.append("uploadedBy", "admin");

      const response = await fetch(`/api/admin/listening-tests/${testId}/sections/${sectionNumber}/audio`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Section Uploaded",
        description: data.testComplete ? "All 4 sections completed! Test is now active." : `Section ${data.audioFile.sectionNumber} uploaded successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listening-tests"] });
      setSelectedFile(null);
      setSectionData({ sectionTitle: "", instructions: "" });
      if (data.testComplete) {
        setCurrentTest(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate questions mutation
  const generateQuestionsMutation = useMutation({
    mutationFn: async ({ audioId, transcript }: { audioId: string; transcript?: string }) => {
      const response = await apiRequest("POST", `/api/admin/audio/${audioId}/generate-questions`, {
        transcript
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Questions Generated",
        description: `Generated ${data.questions?.length || 0} questions successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create reading test mutation
  const createReadingTestMutation = useMutation({
    mutationFn: async (testData: any) => {
      const response = await apiRequest("POST", "/api/admin/reading-tests", testData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reading Test Created",
        description: "Reading test created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reading-tests"] });
      setNewTestData({ title: "", description: "", difficulty: "intermediate" });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload passage mutation
  const uploadPassageMutation = useMutation({
    mutationFn: async ({ testId, passageNumber, title, passage, instructions }: any) => {
      const response = await apiRequest("POST", `/api/admin/reading-tests/${testId}/passages/${passageNumber}`, {
        title,
        passage,
        instructions
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Passage Added",
        description: data.testComplete ? "All 3 passages completed! Test is now active." : `Passage ${data.passage.passageNumber} added successfully with ${data.passage.questions.length} questions`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reading-tests"] });
      setPassageData({ title: "", content: "", instructions: "" });
      if (data.testComplete) {
        setCurrentTest(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    uploadAudioMutation.mutate(selectedFile);
  };

  const handleGenerateQuestions = (audioId: string, audioTranscript?: string) => {
    generateQuestionsMutation.mutate({ 
      audioId, 
      transcript: transcript || audioTranscript 
    });
    setTranscript("");
  };

  const updateProgress = (step: number, status: string, progress: number = 0) => {
    setCurrentStep(step);
    setUploadStatus(status);
    setUploadProgress(progress);
    
    if (uploadStartTime && step > 1) {
      const elapsed = Date.now() - uploadStartTime;
      const estimatedTotal = (elapsed / (step - 1)) * totalSteps;
      const remaining = Math.max(0, estimatedTotal - elapsed);
      setEstimatedTimeLeft(Math.round(remaining / 1000));
    }
  };

  const formatTimeLeft = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleCreateCompleteTest = async () => {
    try {
      setIsUploading(true);
      setUploadStartTime(Date.now());
      setTotalSteps(6); // Create test + 4 sections + finalize
      setCurrentStep(1);
      setEstimatedTimeLeft(180); // Initial estimate: 3 minutes
      
      updateProgress(1, "Validating audio files...", 10);
      
      // Validate that all 4 audio files are selected
      const audioFiles: File[] = [];
      for (let i = 1; i <= 4; i++) {
        const audioInput = document.getElementById(`section-${i}-audio`) as HTMLInputElement;
        if (!audioInput?.files?.[0]) {
          toast({
            title: "Missing Audio File",
            description: `Please select an audio file for Section ${i}`,
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }
        audioFiles.push(audioInput.files[0]);
      }
      
      updateProgress(2, "Creating test structure...", 20);
      
      // First create the test
      const testResponse = await apiRequest("POST", "/api/admin/listening-tests", newTestData);
      const testData = await testResponse.json();
      
      // Upload all 4 sections with progress tracking
      const responses = [];
      for (let i = 1; i <= 4; i++) {
        updateProgress(2 + i, `Uploading Section ${i} audio and generating questions...`, 20 + (i * 15));
        
        const formData = new FormData();
        formData.append("audio", audioFiles[i - 1]);
        formData.append("sectionTitle", `Section ${i}`);
        formData.append("instructions", `Listen and answer the questions for Section ${i}`);
        formData.append("uploadedBy", "admin");

        const response = await fetch(`/api/admin/listening-tests/${testData.test._id}/sections/${i}/audio`, {
          method: "POST",
          body: formData,
        });
        
        responses.push(response);
        
        if (!response.ok) {
          throw new Error(`Section ${i} upload failed: ${await response.text()}`);
        }
      }
      
      updateProgress(6, "Finalizing test activation...", 95);
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateProgress(6, "Test created successfully!", 100);
      
      toast({
        title: "Complete Test Created!",
        description: "All 4 sections uploaded successfully. Test is now active.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listening-tests"] });
      setNewTestData({ title: "", description: "", difficulty: "intermediate" });
      
      // Clear all form inputs
      for (let i = 1; i <= 4; i++) {
        const audioInput = document.getElementById(`section-${i}-audio`) as HTMLInputElement;
        if (audioInput) audioInput.value = "";
      }
      
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to create complete test",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentStep(1);
      setUploadStatus("");
      setEstimatedTimeLeft(0);
      setUploadStartTime(null);
    }
  };

  const handleCreateCompleteReadingTest = async () => {
    try {
      setIsUploading(true);
      setUploadStartTime(Date.now());
      setTotalSteps(5); // Validate + create test + 3 passages
      setCurrentStep(1);
      setEstimatedTimeLeft(240); // Initial estimate: 4 minutes
      
      updateProgress(1, "Validating reading passages...", 10);
      
      // Validate that all 3 passages are filled
      const passages: Array<{title: string, content: string}> = [];
      for (let i = 1; i <= 3; i++) {
        const titleInput = document.getElementById(`bulk-passage-${i}-title`) as HTMLInputElement;
        const contentInput = document.getElementById(`bulk-passage-${i}-content`) as HTMLTextAreaElement;
        
        if (!titleInput?.value || !contentInput?.value) {
          toast({
            title: "Missing Passage",
            description: `Please fill in both title and content for Passage ${i}`,
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }
        
        if (contentInput.value.length < 300) {
          toast({
            title: "Passage Too Short",
            description: `Passage ${i} should be at least 300 words for authentic IELTS questions`,
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }
        
        passages.push({
          title: titleInput.value,
          content: contentInput.value
        });
      }
      
      updateProgress(2, "Creating reading test structure and generating AI questions...", 20);
      
      // Create the reading test with all 3 passages
      const response = await apiRequest("POST", "/api/admin/reading-tests/bulk", {
        ...newTestData,
        passages: passages
      });
      const result = await response.json();
      
      toast({
        title: "Complete Reading Test Created!",
        description: `Test created successfully with ${result.totalQuestions || 40} AI-generated questions across 3 passages.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reading-tests"] });
      setNewTestData({ title: "", description: "", difficulty: "intermediate" });
      
      // Clear all form inputs
      for (let i = 1; i <= 3; i++) {
        const titleInput = document.getElementById(`bulk-passage-${i}-title`) as HTMLInputElement;
        const contentInput = document.getElementById(`bulk-passage-${i}-content`) as HTMLTextAreaElement;
        if (titleInput) titleInput.value = "";
        if (contentInput) contentInput.value = "";
      }
      
    } catch (error: any) {
      const isAIOverload = error.message?.includes("overloaded") || error.message?.includes("503");
      toast({
        title: isAIOverload ? "AI Service Temporarily Overloaded" : "Upload Failed",
        description: isAIOverload 
          ? "The AI service is busy. Please try again in a few minutes, or upload passages individually using the single passage upload below."
          : error.message || "Failed to create complete reading test",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentStep(1);
      setUploadStatus("");
      setEstimatedTimeLeft(0);
      setUploadStartTime(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-600 text-sm">IELTS Test Management Platform</p>
          </div>
          <div className="flex items-center space-x-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Complete Test
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Complete Listening Test</DialogTitle>
                  <p className="text-sm text-slate-600">Upload all 4 sections to create a complete IELTS listening test</p>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Test Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="complete-test-title">Test Title</Label>
                      <Input
                        id="complete-test-title"
                        placeholder="e.g., IELTS Practice Test 2"
                        value={newTestData.title}
                        onChange={(e) => setNewTestData(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="complete-test-difficulty">Difficulty</Label>
                      <Select
                        value={newTestData.difficulty}
                        onValueChange={(value) => setNewTestData(prev => ({ ...prev, difficulty: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="complete-test-description">Description</Label>
                    <Textarea
                      id="complete-test-description"
                      placeholder="Brief description of the test content..."
                      value={newTestData.description}
                      onChange={(e) => setNewTestData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  {/* Section Uploads - Simplified */}
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <h3 className="font-semibold text-slate-900 mb-2">Upload Audio Sections</h3>
                      <p className="text-sm text-slate-600">
                        Just upload the 4 audio files - AI will automatically generate titles, instructions, and questions
                      </p>
                    </div>
                    {[1, 2, 3, 4].map((sectionNum) => (
                      <Card key={sectionNum} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-blue-600">{sectionNum}</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-slate-800">Section {sectionNum}</h4>
                              <p className="text-xs text-slate-500">
                                {sectionNum === 1 ? "Everyday conversation" :
                                 sectionNum === 2 ? "Monologue/Talk" :
                                 sectionNum === 3 ? "Academic conversation" :
                                 "Academic lecture"}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            AI Generated
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor={`section-${sectionNum}-audio`} className="text-sm font-medium">
                              Audio File <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`section-${sectionNum}-audio`}
                              type="file"
                              accept="audio/mp3,audio/wav,audio/m4a,audio/ogg"
                              className="mt-1"
                              required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Supported: MP3, WAV, M4A, OGG (max 100MB)
                            </p>
                          </div>
                          
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
                              <div className="text-xs text-blue-700">
                                <p className="font-medium mb-1">AI will automatically generate:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                                  <li>Section title and description</li>
                                  <li>Listening instructions</li>
                                  <li>Audio transcript</li>
                                  <li>IELTS-style questions (10-11 per section)</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button
                    onClick={() => {
                      handleCreateCompleteTest();
                    }}
                    disabled={!newTestData.title || isUploading}
                    className="w-full"
                  >
                    {isUploading ? "Processing..." : "Upload Audio Files & Let AI Create Test"}
                  </Button>

                  {/* Progress Overlay */}
                  {isUploading && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <Card className="w-96 max-w-[90vw]">
                        <CardContent className="p-6">
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                              <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                            </div>
                            
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                Creating Listening Test
                              </h3>
                              <p className="text-sm text-slate-600">
                                {uploadStatus}
                              </p>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between text-sm text-slate-600">
                                <span>Step {currentStep} of {totalSteps}</span>
                                <span>
                                  {estimatedTimeLeft > 0 ? `~${formatTimeLeft(estimatedTimeLeft)} left` : ''}
                                </span>
                              </div>
                              <Progress value={uploadProgress} className="h-3" />
                            </div>

                            <div className="text-xs text-slate-500 space-y-1">
                              <p>✓ AI is analyzing audio files</p>
                              <p>✓ Generating transcripts</p>
                              <p>✓ Creating IELTS-style questions</p>
                              <p className="font-medium text-blue-600">Please don't close this window</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active Tests</p>
                  <p className="text-2xl font-bold text-slate-900">{sessions.filter(s => s.status === 'in_progress').length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Audio Files</p>
                  <p className="text-2xl font-bold text-slate-900">{stats?.audioFiles || 0}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Music className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">AI Evaluations</p>
                  <p className="text-2xl font-bold text-slate-900">{sessions.filter(s => s.status === 'completed').length * 2}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Bot className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Avg Band Score</p>
                  <p className="text-2xl font-bold text-slate-900">6.8</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sessions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sessions">Test Sessions</TabsTrigger>
            <TabsTrigger value="listening-tests">Listening Tests</TabsTrigger>
            <TabsTrigger value="reading-tests">Reading Tests</TabsTrigger>
            <TabsTrigger value="audio">Audio Management</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            {/* Test Sessions Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Test Sessions</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter tests..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tests</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-1" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Session ID</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Test Type</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Progress</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Band Score</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {sessions.slice(0, 10).map((session: any) => (
                        <tr key={session._id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                              {session._id?.toString().slice(-8) || 'N/A'}
                            </code>
                          </td>
                          <td className="py-3 px-4 capitalize">{session.testType || 'academic'}</td>
                          <td className="py-3 px-4">
                            {new Date(session.startTime).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-slate-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    session.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                                  }`}
                                  style={{ 
                                    width: session.status === 'completed' ? '100%' : '75%'
                                  }}
                                />
                              </div>
                              <span className="text-xs text-slate-600">
                                {session.status === 'completed' ? 'Complete' : '75%'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {session.overallBand ? (
                              <span className="font-semibold text-primary">
                                {session.overallBand}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant={
                                session.status === 'completed' ? 'default' : 
                                session.status === 'in_progress' ? 'secondary' : 'outline'
                              }
                              className={
                                session.status === 'completed' ? 'bg-green-100 text-green-800' :
                                session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : ''
                              }
                            >
                              {session.status?.replace('_', ' ') || 'in progress'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listening-tests">
            {/* Listening Tests Management */}
            <div className="space-y-6">
              {/* Create New Test */}
              <Card>
                <CardHeader>
                  <CardTitle>Create New Listening Test</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="test-title">Test Title</Label>
                      <Input
                        id="test-title"
                        placeholder="e.g., IELTS Practice Test 1"
                        value={newTestData.title}
                        onChange={(e) => setNewTestData(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="test-description">Description</Label>
                      <Input
                        id="test-description"
                        placeholder="Test description"
                        value={newTestData.description}
                        onChange={(e) => setNewTestData(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Select
                        value={newTestData.difficulty}
                        onValueChange={(value) => setNewTestData(prev => ({ ...prev, difficulty: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={() => createTestMutation.mutate(newTestData)}
                    disabled={!newTestData.title || createTestMutation.isPending}
                    className="mt-4"
                  >
                    {createTestMutation.isPending ? "Creating..." : "Create Test"}
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Tests */}
              <Card>
                <CardHeader>
                  <CardTitle>Listening Tests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {listeningTests.length === 0 ? (
                      <div className="text-center py-8">
                        <ClipboardList className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600">No listening tests created yet</p>
                        <p className="text-sm text-slate-500">Create your first listening test above</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {listeningTests.map((test: any) => (
                          <Card key={test._id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-slate-900">{test.title}</h3>
                                <Badge
                                  variant={test.status === 'active' ? 'default' : test.status === 'draft' ? 'secondary' : 'outline'}
                                  className={
                                    test.status === 'active' ? 'bg-green-100 text-green-800' :
                                    test.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : ''
                                  }
                                >
                                  {test.status}
                                </Badge>
                              </div>
                              
                              {test.description && (
                                <p className="text-sm text-slate-600 mb-3">{test.description}</p>
                              )}

                              <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                                <span>Sections: {test.sections?.length || 0}/4</span>
                                <span>{test.difficulty}</span>
                              </div>

                              <div className="grid grid-cols-4 gap-2 mb-4">
                                {[1, 2, 3, 4].map((sectionNum) => {
                                  const hasSection = test.sections?.length >= sectionNum;
                                  return (
                                    <div
                                      key={sectionNum}
                                      className={`text-center p-2 rounded text-xs font-medium ${
                                        hasSection
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      Section {sectionNum}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex space-x-2">
                                {test.status === 'draft' && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentTest(test)}
                                      >
                                        <Upload className="h-4 w-4 mr-1" />
                                        Upload Section
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Upload Section Audio</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <Label>Current Test: {test.title}</Label>
                                          <p className="text-xs text-slate-500">
                                            Next section: {(test.sections?.length || 0) + 1}/4
                                          </p>
                                        </div>

                                        <div>
                                          <Label htmlFor="section-title">Section Title</Label>
                                          <Input
                                            id="section-title"
                                            placeholder={`Section ${(test.sections?.length || 0) + 1} - Conversation`}
                                            value={sectionData.sectionTitle}
                                            onChange={(e) => setSectionData(prev => ({ ...prev, sectionTitle: e.target.value }))}
                                          />
                                        </div>

                                        <div>
                                          <Label htmlFor="section-instructions">Instructions</Label>
                                          <Textarea
                                            id="section-instructions"
                                            placeholder="Listen carefully and answer the questions..."
                                            value={sectionData.instructions}
                                            onChange={(e) => setSectionData(prev => ({ ...prev, instructions: e.target.value }))}
                                          />
                                        </div>

                                        <div>
                                          <Label htmlFor="section-audio">Audio File</Label>
                                          <Input
                                            id="section-audio"
                                            type="file"
                                            accept="audio/*"
                                            onChange={handleFileSelect}
                                            className="mt-1"
                                          />
                                        </div>

                                        <Button
                                          onClick={() => {
                                            if (selectedFile && currentTest) {
                                              uploadSectionAudioMutation.mutate({
                                                testId: currentTest._id,
                                                sectionNumber: (currentTest.sections?.length || 0) + 1,
                                                file: selectedFile,
                                                sectionTitle: sectionData.sectionTitle || `Section ${(currentTest.sections?.length || 0) + 1}`,
                                                instructions: sectionData.instructions || "Listen and answer the questions."
                                              });
                                            }
                                          }}
                                          disabled={!selectedFile || !currentTest || uploadSectionAudioMutation.isPending}
                                          className="w-full"
                                        >
                                          {uploadSectionAudioMutation.isPending ? "Uploading..." : "Upload Section"}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reading-tests">
            {/* Reading Tests Management */}
            <div className="space-y-6">
              {/* Create New Reading Test */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Create New Reading Test</CardTitle>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Complete Test (3 Passages)
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Create Complete Reading Test</DialogTitle>
                          <p className="text-sm text-slate-600">Upload all 3 passages at once - AI will generate authentic IELTS questions automatically</p>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Test Info */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="bulk-test-title">Test Title</Label>
                              <Input
                                id="bulk-test-title"
                                placeholder="e.g., IELTS Academic Reading Practice Test 1"
                                value={newTestData.title}
                                onChange={(e) => setNewTestData(prev => ({ ...prev, title: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="bulk-test-difficulty">Difficulty</Label>
                              <Select
                                value={newTestData.difficulty}
                                onValueChange={(value) => setNewTestData(prev => ({ ...prev, difficulty: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="beginner">Beginner</SelectItem>
                                  <SelectItem value="intermediate">Intermediate</SelectItem>
                                  <SelectItem value="advanced">Advanced</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="bulk-test-description">Description</Label>
                            <Textarea
                              id="bulk-test-description"
                              placeholder="Complete IELTS Academic reading test with authentic question types..."
                              value={newTestData.description}
                              onChange={(e) => setNewTestData(prev => ({ ...prev, description: e.target.value }))}
                            />
                          </div>

                          {/* 3 Passages */}
                          <div className="space-y-6">
                            <div className="text-center mb-4">
                              <h3 className="font-semibold text-slate-900 mb-2">Upload 3 Reading Passages</h3>
                              <p className="text-sm text-slate-600">
                                AI will generate 13-14 authentic IELTS questions per passage with appropriate difficulty progression
                              </p>
                            </div>

                            {[1, 2, 3].map((passageNum) => (
                              <Card key={passageNum} className="p-4 border-2 border-dashed border-slate-200">
                                <div className="flex items-center space-x-3 mb-4">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-semibold text-blue-600">{passageNum}</span>
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-slate-800">Passage {passageNum}</h4>
                                    <p className="text-xs text-slate-500">
                                      {passageNum === 1 ? "Moderate difficulty - General interest topic" :
                                       passageNum === 2 ? "Medium difficulty - Work/education topic" :
                                       "High difficulty - Academic/scientific topic"}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  <div>
                                    <Label htmlFor={`bulk-passage-${passageNum}-title`}>Passage Title</Label>
                                    <Input
                                      id={`bulk-passage-${passageNum}-title`}
                                      placeholder={
                                        passageNum === 1 ? "e.g., The Benefits of Urban Farming" :
                                        passageNum === 2 ? "e.g., Modern Workplace Communication" :
                                        "e.g., Climate Change and Biodiversity"
                                      }
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor={`bulk-passage-${passageNum}-content`}>Passage Content (800-1000 words)</Label>
                                    <Textarea
                                      id={`bulk-passage-${passageNum}-content`}
                                      placeholder="Paste the complete reading passage here..."
                                      className="min-h-32"
                                    />
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>

                          {/* AI Info Panel */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div className="text-sm text-blue-800">
                                <p className="font-medium mb-2">AI will automatically generate authentic IELTS questions:</p>
                                <div className="grid grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <p className="font-medium text-blue-900">Passage 1 (13-14 Qs)</p>
                                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                                      <li>Multiple Choice</li>
                                      <li>True/False/Not Given</li>
                                      <li>Matching Headings</li>
                                      <li>Sentence Completion</li>
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="font-medium text-blue-900">Passage 2 (13-14 Qs)</p>
                                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                                      <li>Matching Information</li>
                                      <li>Summary Completion</li>
                                      <li>Short Answer Questions</li>
                                      <li>Fill in the Blanks</li>
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="font-medium text-blue-900">Passage 3 (13-14 Qs)</p>
                                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                                      <li>Multiple Choice</li>
                                      <li>Yes/No/Not Given</li>
                                      <li>Matching Features</li>
                                      <li>Diagram Completion</li>
                                    </ul>
                                  </div>
                                </div>
                                <p className="text-blue-700 mt-3 font-medium">
                                  Total: ~40 questions following authentic IELTS Academic format
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Button
                              onClick={handleCreateCompleteReadingTest}
                              disabled={!newTestData.title || isUploading}
                              className="w-full bg-blue-600 hover:bg-blue-700"
                            >
                              {isUploading ? "Processing..." : "Create Complete Reading Test"}
                            </Button>

                            {/* Progress Overlay for Reading Test */}
                            {isUploading && (
                              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <Card className="w-96 max-w-[90vw]">
                                  <CardContent className="p-6">
                                    <div className="text-center space-y-4">
                                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                        <Sparkles className="h-8 w-8 text-blue-600 animate-pulse" />
                                      </div>
                                      
                                      <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                          Creating Reading Test
                                        </h3>
                                        <p className="text-sm text-slate-600">
                                          {uploadStatus}
                                        </p>
                                      </div>

                                      <div className="space-y-3">
                                        <div className="flex justify-between text-sm text-slate-600">
                                          <span>Step {currentStep} of {totalSteps}</span>
                                          <span>
                                            {estimatedTimeLeft > 0 ? `~${formatTimeLeft(estimatedTimeLeft)} left` : ''}
                                          </span>
                                        </div>
                                        <Progress value={uploadProgress} className="h-3" />
                                      </div>

                                      <div className="text-xs text-slate-500 space-y-1">
                                        <p>✓ AI is analyzing reading passages</p>
                                        <p>✓ Generating authentic IELTS questions</p>
                                        <p>✓ Creating mixed question types</p>
                                        <p className="font-medium text-blue-600">This may take 2-4 minutes</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                            
                            <div className="text-xs text-center text-slate-500">
                              <p>If AI service is overloaded, you can create a test above and add passages individually.</p>
                              <p>Each passage takes ~30-60 seconds to process with AI question generation.</p>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="reading-test-title">Test Title</Label>
                      <Input
                        id="reading-test-title"
                        placeholder="e.g., IELTS Academic Reading Test 1"
                        value={newTestData.title}
                        onChange={(e) => setNewTestData(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reading-test-description">Description</Label>
                      <Input
                        id="reading-test-description"
                        placeholder="Test description"
                        value={newTestData.description}
                        onChange={(e) => setNewTestData(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reading-difficulty">Difficulty</Label>
                      <Select
                        value={newTestData.difficulty}
                        onValueChange={(value) => setNewTestData(prev => ({ ...prev, difficulty: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={() => createReadingTestMutation.mutate(newTestData)}
                    disabled={!newTestData.title || createReadingTestMutation.isPending}
                    className="mt-4"
                  >
                    {createReadingTestMutation.isPending ? "Creating..." : "Create Reading Test (Individual Passages)"}
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Reading Tests */}
              <Card>
                <CardHeader>
                  <CardTitle>Reading Tests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {readingTests.length === 0 ? (
                      <div className="text-center py-8">
                        <ClipboardList className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600">No reading tests created yet</p>
                        <p className="text-sm text-slate-500">Create your first reading test above</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {readingTests.map((test: any) => (
                          <Card key={test._id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-slate-900">{test.title}</h3>
                                <Badge
                                  variant={test.status === 'active' ? 'default' : test.status === 'draft' ? 'secondary' : 'outline'}
                                  className={
                                    test.status === 'active' ? 'bg-green-100 text-green-800' :
                                    test.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : ''
                                  }
                                >
                                  {test.status}
                                </Badge>
                              </div>
                              
                              {test.description && (
                                <p className="text-sm text-slate-600 mb-3">{test.description}</p>
                              )}

                              <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                                <span>Passages: {test.passages?.length || 0}/3</span>
                                <span>{test.difficulty}</span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 mb-4">
                                {[1, 2, 3].map((passageNum) => {
                                  const hasPassage = test.passages?.length >= passageNum;
                                  return (
                                    <div
                                      key={passageNum}
                                      className={`text-center p-2 rounded text-xs font-medium ${
                                        hasPassage
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      Passage {passageNum}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex space-x-2">
                                {test.status === 'draft' && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentTest(test)}
                                      >
                                        <Upload className="h-4 w-4 mr-1" />
                                        Add Passage
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle>Add Reading Passage</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <Label>Current Test: {test.title}</Label>
                                          <p className="text-xs text-slate-500">
                                            Next passage: {(test.passages?.length || 0) + 1}/3
                                          </p>
                                        </div>

                                        <div>
                                          <Label htmlFor="passage-title">Passage Title</Label>
                                          <Input
                                            id="passage-title"
                                            placeholder={`The Impact of Technology on Education`}
                                            value={passageData.title}
                                            onChange={(e) => setPassageData(prev => ({ ...prev, title: e.target.value }))}
                                          />
                                        </div>

                                        <div>
                                          <Label htmlFor="passage-content">Passage Content</Label>
                                          <Textarea
                                            id="passage-content"
                                            placeholder="Paste the full reading passage here (800-1000 words)..."
                                            value={passageData.content}
                                            onChange={(e) => setPassageData(prev => ({ ...prev, content: e.target.value }))}
                                            className="min-h-32"
                                          />
                                        </div>

                                        <div>
                                          <Label htmlFor="passage-instructions">Instructions (Optional)</Label>
                                          <Textarea
                                            id="passage-instructions"
                                            placeholder="Questions 1-13. Read the passage and answer the questions below."
                                            value={passageData.instructions}
                                            onChange={(e) => setPassageData(prev => ({ ...prev, instructions: e.target.value }))}
                                          />
                                        </div>

                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                          <div className="flex items-start space-x-2">
                                            <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
                                            <div className="text-xs text-blue-700">
                                              <p className="font-medium mb-1">AI will automatically generate:</p>
                                              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                                                <li>13-14 IELTS-style questions per passage</li>
                                                <li>Mixed question types (multiple choice, T/F/NG, fill-in-blank)</li>
                                                <li>Appropriate difficulty for passage number</li>
                                                <li>Answer keys for automatic grading</li>
                                              </ul>
                                            </div>
                                          </div>
                                        </div>

                                        <Button
                                          onClick={() => {
                                            if (passageData.content && passageData.title && currentTest) {
                                              uploadPassageMutation.mutate({
                                                testId: currentTest._id,
                                                passageNumber: (currentTest.passages?.length || 0) + 1,
                                                title: passageData.title,
                                                passage: passageData.content,
                                                instructions: passageData.instructions || `Questions ${((currentTest.passages?.length || 0) + 1 - 1)*13 + 1}-${((currentTest.passages?.length || 0) + 1)*13}. Read the passage and answer the questions below.`
                                              });
                                            }
                                          }}
                                          disabled={!passageData.content || !passageData.title || !currentTest || uploadPassageMutation.isPending}
                                          className="w-full"
                                        >
                                          {uploadPassageMutation.isPending ? "Generating Questions..." : "Add Passage & Generate Questions"}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audio">
            {/* Audio Management */}
            <Card>
              <CardHeader>
                <CardTitle>Audio File Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {audioFiles.length === 0 ? (
                    <div className="text-center py-8">
                      <FileAudio className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600">No audio files uploaded yet</p>
                      <p className="text-sm text-slate-500">Upload audio files to start creating listening tests</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {audioFiles.map((audio: any) => (
                        <Card key={audio._id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <FileAudio className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {audio.originalName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {(audio.size / (1024 * 1024)).toFixed(1)} MB
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(audio.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            
                            <div className="mt-4 space-y-2">
                              <audio controls className="w-full">
                                <source src={`/uploads/audio/${audio.filename}`} type={audio.mimeType} />
                                Your browser does not support the audio element.
                              </audio>
                              
                              <div className="text-center">
                                <Badge variant="secondary" className="text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Questions Auto-Generated
                                </Badge>
                                <p className="text-xs text-slate-500 mt-1">
                                  AI automatically creates questions when audio is uploaded to a test
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
