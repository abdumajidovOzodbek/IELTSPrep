import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useTestSession(sessionId?: string) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: session, isLoading, error } = useQuery({
    queryKey: [`/api/sessions/${sessionId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/sessions/${sessionId}`);
      return response.json();
    },
    enabled: !!sessionId,
    refetchInterval: 30000, // Refetch every 30 seconds to keep session updated
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!sessionId) throw new Error("No session ID");
      const response = await apiRequest("PATCH", `/api/sessions/${sessionId}`, updates);
      return response.json();
    },
    onSuccess: (updatedSession) => {
      // Update the cache
      queryClient.setQueryData([`/api/sessions/${sessionId}`], updatedSession);
      
      // Navigate to next section if currentSection changed
      if (updatedSession.currentSection !== session?.currentSection) {
        if (updatedSession.currentSection === 'completed') {
          setLocation(`/results/${sessionId}`);
        } else {
          setLocation(`/${updatedSession.currentSection}/${sessionId}`);
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Session update failed",
        description: error.message || "Failed to update test session",
        variant: "destructive",
      });
    }
  });

  const calculateOverallBandMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No session ID");
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/calculate-overall`);
      return response.json();
    },
    onSuccess: (updatedSession) => {
      queryClient.setQueryData([`/api/sessions/${sessionId}`], updatedSession);
      toast({
        title: "Test completed!",
        description: `Your overall band score: ${updatedSession.overallBand}`,
      });
      setLocation(`/results/${sessionId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Score calculation failed",
        description: error.message || "Failed to calculate final scores",
        variant: "destructive",
      });
    }
  });

  const updateSession = (updates: any) => {
    updateSessionMutation.mutate(updates);
  };

  const completeTest = () => {
    calculateOverallBandMutation.mutate();
  };

  const getTimeRemaining = () => {
    if (!session?.startTime || !session?.timeRemaining) return 0;
    
    const startTime = new Date(session.startTime);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const remaining = session.timeRemaining - elapsed;
    
    return Math.max(0, remaining);
  };

  const getSectionProgress = () => {
    const sections = ['listening', 'reading', 'writing', 'speaking'];
    const current = session?.currentSection || 'listening';
    const currentIndex = sections.indexOf(current);
    return currentIndex >= 0 ? ((currentIndex + 1) / sections.length) * 100 : 0;
  };

  const getCompletedSections = () => {
    if (!session) return [];
    
    const completed = [];
    if (session.listeningBand !== null && session.listeningBand !== undefined) completed.push('listening');
    if (session.readingBand !== null && session.readingBand !== undefined) completed.push('reading');
    if (session.writingBand !== null && session.writingBand !== undefined) completed.push('writing');
    if (session.speakingBand !== null && session.speakingBand !== undefined) completed.push('speaking');
    
    return completed;
  };

  const isTestComplete = () => {
    return session?.status === 'completed' || getCompletedSections().length === 4;
  };

  const canAccessSection = (sectionId: string) => {
    const sections = ['listening', 'reading', 'writing', 'speaking'];
    const currentIndex = sections.indexOf(session?.currentSection || 'listening');
    const targetIndex = sections.indexOf(sectionId);
    
    // Can access current section or any completed section
    return targetIndex <= currentIndex;
  };

  return {
    session,
    isLoading,
    error,
    updateSession,
    completeTest,
    getTimeRemaining,
    getSectionProgress,
    getCompletedSections,
    isTestComplete,
    canAccessSection,
    isUpdating: updateSessionMutation.isPending,
    isCalculating: calculateOverallBandMutation.isPending
  };
}
