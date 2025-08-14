import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Save, 
  FileText, 
  Clock, 
  RotateCcw, 
  RotateCw,
  Bold,
  Italic,
  Underline,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WritingEditorProps {
  content: string;
  onChange: (content: string) => void;
  minWords: number;
  onSubmit: () => void;
  isSubmitting: boolean;
  task: number;
}

export default function WritingEditor({
  content,
  onChange,
  minWords,
  onSubmit,
  isSubmitting,
  task
}: WritingEditorProps) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const progress = Math.min((wordCount / minWords) * 100, 100);
  const timeEstimate = task === 1 ? 20 : 40; // minutes

  // Auto-save functionality
  useEffect(() => {
    const autoSaveTimer = setTimeout(() => {
      if (content.trim().length > 0) {
        setIsAutoSaving(true);
        // Simulate auto-save
        setTimeout(() => {
          setLastSaved(new Date());
          setIsAutoSaving(false);
        }, 500);
      }
    }, 2000);

    return () => clearTimeout(autoSaveTimer);
  }, [content]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit' 
    });
  };

  const getWordCountStatus = () => {
    if (wordCount === 0) return 'text-slate-500';
    if (wordCount < minWords) return 'text-orange-600';
    if (wordCount >= minWords && wordCount < minWords * 1.5) return 'text-green-600';
    return 'text-blue-600';
  };

  const getProgressColor = () => {
    if (progress < 50) return 'bg-orange-500';
    if (progress < 100) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Writing Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Word Count</p>
                <p className={cn("text-2xl font-bold", getWordCountStatus())}>
                  {wordCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Target Time</p>
                <p className="text-2xl font-bold text-orange-600">{timeEstimate}m</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Save className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Auto-save</p>
                <p className="text-sm font-medium text-green-600">
                  {isAutoSaving ? 'Saving...' : 
                   lastSaved ? `Saved ${formatTime(lastSaved)}` : 'Not saved'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Writing Progress</span>
              <span className="text-slate-900 font-medium">{wordCount} / {minWords}+ words</span>
            </div>
            <Progress value={progress} className="h-2">
              <div 
                className={cn("h-2 rounded-full transition-all duration-300", getProgressColor())}
                style={{ width: `${progress}%` }}
              />
            </Progress>
            <p className="text-xs text-slate-600">
              {wordCount < minWords 
                ? `${minWords - wordCount} more words needed to reach minimum`
                : `✓ Minimum word count achieved`
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <span>Your Answer - Task {task}</span>
              {wordCount >= minWords && (
                <Badge className="bg-green-100 text-green-800">Ready to submit</Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled={isAutoSaving}>
                {isAutoSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {lastSaved ? 'Saved' : 'Save Draft'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Italic className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Underline className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-slate-300 mx-2" />
              <Button variant="ghost" size="sm">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="text-sm text-slate-600">
              Minimum {minWords} words required
            </div>
          </div>

          {/* Text Area */}
          <Textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Start writing your ${task === 1 ? 'Task 1 response' : 'Task 2 essay'} here...`}
            className="min-h-[400px] resize-none border-none focus:ring-0 text-base leading-relaxed"
          />

          {/* AI Writing Assistant */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">AI Writing Assistant</h4>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">Real-time</Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div className="flex items-center justify-between">
                <span className="text-blue-700 font-medium">Task Achievement:</span>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  Good ✓
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700 font-medium">Coherence:</span>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  Clear ✓
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700 font-medium">Vocabulary:</span>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  Good ✓
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700 font-medium">Grammar:</span>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                  Minor issues ⚠
                </Badge>
              </div>
            </div>
            
            <p className="text-blue-800 text-sm">
              Your writing shows good structure and clear ideas. Consider using more complex sentence structures 
              and varied vocabulary to enhance your score.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || wordCount < minWords}
          size="lg"
          className="px-8"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Evaluating with AI...
            </>
          ) : (
            <>
              Submit Task {task}
              {wordCount < minWords && (
                <span className="ml-2 text-xs opacity-75">
                  ({minWords - wordCount} more words needed)
                </span>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
