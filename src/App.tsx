import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlannerProvider } from "@/contexts/PlannerContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PlannerDashboard from "./pages/PlannerDashboard";
import Budget from "./pages/Budget";
import Tasks from "./pages/Tasks";
import Guests from "./pages/Guests";
import Vendors from "./pages/Vendors";
import AiChat from "./pages/AiChat";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PlannerProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/clients" element={<ProtectedPage><PlannerDashboard /></ProtectedPage>} />
              <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
              <Route path="/budget" element={<ProtectedPage><Budget /></ProtectedPage>} />
              <Route path="/tasks" element={<ProtectedPage><Tasks /></ProtectedPage>} />
              <Route path="/guests" element={<ProtectedPage><Guests /></ProtectedPage>} />
              <Route path="/vendors" element={<ProtectedPage><Vendors /></ProtectedPage>} />
              <Route path="/ai-chat" element={<ProtectedPage><AiChat /></ProtectedPage>} />
              <Route path="/settings" element={<ProtectedPage><ProfileSettings /></ProtectedPage>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PlannerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
