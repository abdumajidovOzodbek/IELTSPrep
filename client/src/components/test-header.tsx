import { Clock, Settings, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface TestHeaderProps {
  session: any;
}

export default function TestHeader({ session }: TestHeaderProps) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = session.currentSection === 'listening' ? 25 : 
                  session.currentSection === 'reading' ? 50 :
                  session.currentSection === 'writing' ? 75 : 100;

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40 pl-64">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-graduation-cap text-primary text-xl"></i>
              <span className="text-xl font-semibold text-slate-900">IELTS Test Platform</span>
            </div>
            <Badge variant="secondary">Computer Delivered Test</Badge>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-slate-100 px-3 py-2 rounded-lg">
              <Clock className="h-4 w-4 text-slate-600" />
              <span className="font-mono text-lg font-semibold">
                {formatTime(session.timeRemaining || 0)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Progress:</span>
              <div className="w-24 bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <HelpCircle className="h-4 w-4 mr-2" />
                Help
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
