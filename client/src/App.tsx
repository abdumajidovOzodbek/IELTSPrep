import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import ListeningTest from "@/pages/listening-test";
import ReadingTest from "@/pages/reading-test";
import WritingTest from "@/pages/writing-test";
import SpeakingTest from "@/pages/speaking-test";
import AdminDashboard from "@/pages/admin";
import Results from "@/pages/results";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/listening/:sessionId" component={ListeningTest} />
      <Route path="/reading/:sessionId" component={ReadingTest} />
      <Route path="/writing/:sessionId" component={WritingTest} />
      <Route path="/speaking/:sessionId" component={SpeakingTest} />
      <Route path="/results/:sessionId" component={Results} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-slate-50">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
