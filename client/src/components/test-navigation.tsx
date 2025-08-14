import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Headphones, 
  BookOpen, 
  PenTool, 
  Mic, 
  CheckCircle2,
  Clock,
  Lock
} from "lucide-react";

interface TestNavigationProps {
  currentSection: string;
  sessionId: string;
}

interface SectionInfo {
  id: string;
  name: string;
  icon: any;
  duration: string;
  status: 'completed' | 'active' | 'locked' | 'available';
  progress?: number;
}

export default function TestNavigation({ currentSection, sessionId }: TestNavigationProps) {
  const [, setLocation] = useLocation();

  const sections: SectionInfo[] = [
    {
      id: 'listening',
      name: 'Listening',
      icon: Headphones,
      duration: '30 min',
      status: currentSection === 'listening' ? 'active' : 
              getSectionStatus('listening', currentSection),
      progress: currentSection === 'listening' ? undefined : 100
    },
    {
      id: 'reading', 
      name: 'Reading',
      icon: BookOpen,
      duration: '60 min',
      status: currentSection === 'reading' ? 'active' :
              getSectionStatus('reading', currentSection),
      progress: currentSection === 'reading' ? 65 : 
               getSectionStatus('reading', currentSection) === 'completed' ? 100 : 0
    },
    {
      id: 'writing',
      name: 'Writing', 
      icon: PenTool,
      duration: '60 min',
      status: currentSection === 'writing' ? 'active' :
              getSectionStatus('writing', currentSection)
    },
    {
      id: 'speaking',
      name: 'Speaking',
      icon: Mic, 
      duration: '11-14 min',
      status: currentSection === 'speaking' ? 'active' :
              getSectionStatus('speaking', currentSection)
    }
  ];

  function getSectionStatus(sectionId: string, current: string): 'completed' | 'locked' | 'available' {
    const order = ['listening', 'reading', 'writing', 'speaking'];
    const currentIndex = order.indexOf(current);
    const sectionIndex = order.indexOf(sectionId);
    
    if (sectionIndex < currentIndex) return 'completed'; // Previous sections are completed and locked
    if (sectionIndex > currentIndex) return 'locked';   // Future sections are locked
    return 'available'; // Only current section is available
  }

  const handleSectionClick = (sectionId: string, status: string) => {
    if (status === 'locked' || status === 'completed') return;
    // Only allow clicking on current active section
    if (sectionId !== currentSection) return;
    setLocation(`/test/${sessionId}/${sectionId}`);
  };

  return (
    <aside className="fixed top-0 left-0 w-64 h-screen bg-white shadow-sm border-r border-slate-200 z-50 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
          Test Sections
        </h3>
        
        <nav className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = section.status === 'active';
            const isCompleted = section.status === 'completed';
            const isLocked = section.status === 'locked';
            
            return (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id, section.status)}
                disabled={isLocked || isCompleted}
                className={cn(
                  "flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive && "text-white bg-primary",
                  !isActive && !isLocked && !isCompleted && "text-slate-700 hover:bg-slate-100",
                  (isLocked || isCompleted) && "text-slate-400 cursor-not-allowed",
                  isCompleted && !isActive && "text-green-700 bg-green-50"
                )}
              >
                <Icon className="h-5 w-5 mr-3" />
                <span className="flex-1 text-left">{section.name}</span>
                <div className="ml-auto flex items-center space-x-2">
                  {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {isLocked && <Lock className="h-4 w-4" />}
                  <Badge variant={isActive ? "secondary" : "outline"} className="text-xs">
                    {section.duration}
                  </Badge>
                </div>
              </button>
            );
          })}
        </nav>
        
        {/* Progress Overview */}
        <div className="mt-8 p-4 bg-slate-50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Section Progress</h4>
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{section.name}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-slate-200 rounded-full h-1.5">
                    <div 
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        section.status === 'completed' ? "bg-green-500" :
                        section.status === 'active' ? "bg-yellow-500" : "bg-slate-200"
                      )}
                      style={{ 
                        width: section.status === 'completed' ? '100%' :
                               section.progress ? `${section.progress}%` :
                               section.status === 'active' ? '50%' : '0%'
                      }}
                    />
                  </div>
                  {section.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Timer Display */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2 text-blue-800">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Current Section</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-900">25:30</div>
          <div className="text-xs text-blue-700">Time remaining</div>
        </div>
      </div>
    </aside>
  );
}
