
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

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["/api/admin/sessions"],
  });

  const { data: audioFiles = [] } = useQuery({
    queryKey: ["/api/admin/audio/list"],
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
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Audio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Listening Audio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="audio-file">Audio File</Label>
                    <Input
                      id="audio-file"
                      type="file"
                      accept="audio/*"
                      onChange={handleFileSelect}
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Supported: MP3, WAV, M4A (max 100MB)
                    </p>
                  </div>

                  {selectedFile && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <FileAudio className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{selectedFile.name}</span>
                        <span className="text-xs text-slate-500">
                          ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      </div>
                      
                      {isUploading && (
                        <div className="space-y-2">
                          <Progress value={uploadProgress} />
                          <p className="text-xs text-slate-600">Uploading...</p>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    className="w-full"
                  >
                    {isUploading ? "Uploading..." : "Upload Audio"}
                  </Button>
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
                              
                              <div className="flex space-x-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="flex-1">
                                      <Sparkles className="h-4 w-4 mr-1" />
                                      Generate Questions
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Generate AI Questions</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="transcript">Audio Transcript (Optional)</Label>
                                        <Textarea
                                          id="transcript"
                                          placeholder="Provide transcript to improve question generation..."
                                          value={transcript}
                                          onChange={(e) => setTranscript(e.target.value)}
                                          className="mt-1"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                          AI will generate better questions with a transcript
                                        </p>
                                      </div>
                                      <Button
                                        onClick={() => handleGenerateQuestions(audio._id, audio.transcript)}
                                        disabled={generateQuestionsMutation.isPending}
                                        className="w-full"
                                      >
                                        {generateQuestionsMutation.isPending ? "Generating..." : "Generate Questions"}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
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
