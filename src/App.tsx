import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlannerProvider } from "@/contexts/PlannerContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
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
import VendorDirectory from "./pages/VendorDirectory";
import VendorSettings from "./pages/VendorSettings";
import VendorDashboard from "./pages/VendorDashboard";
import AiChat from "./pages/AiChat";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";
import PlannerProfile from "./pages/PlannerProfile";
import PlannerDirectory from "./pages/PlannerDirectory";
import ResetPassword from "./pages/ResetPassword";
import TimelinePage from "./pages/Timeline";
import TimelineShare from "./pages/TimelineShare";
import GuestRsvp from "./pages/GuestRsvp";

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
            <NotificationProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/planners" element={<PlannerDirectory />} />
                <Route path="/vendors-directory" element={<VendorDirectory />} />
                <Route path="/planner/:id" element={<PlannerProfile />} />
                <Route path="/clients" element={<ProtectedPage><PlannerDashboard /></ProtectedPage>} />
                <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
                <Route path="/budget" element={<ProtectedPage><Budget /></ProtectedPage>} />
                <Route path="/tasks" element={<ProtectedPage><Tasks /></ProtectedPage>} />
                <Route path="/guests" element={<ProtectedPage><Guests /></ProtectedPage>} />
                <Route path="/vendors" element={<ProtectedPage><Vendors /></ProtectedPage>} />
                <Route path="/vendor-dashboard" element={<ProtectedPage><VendorDashboard /></ProtectedPage>} />
                <Route path="/vendor-settings" element={<ProtectedPage><VendorSettings /></ProtectedPage>} />
                <Route path="/ai-chat" element={<ProtectedPage><AiChat /></ProtectedPage>} />
                <Route path="/settings" element={<ProtectedPage><ProfileSettings /></ProtectedPage>} />
                <Route path="/timeline" element={<ProtectedPage><TimelinePage /></ProtectedPage>} />
                <Route path="/timeline/share/:token" element={<TimelineShare />} />
                <Route path="/rsvp/:token" element={<GuestRsvp />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationProvider>
          </PlannerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
