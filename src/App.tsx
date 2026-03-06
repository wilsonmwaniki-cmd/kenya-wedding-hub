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
import VendorDirectory from "./pages/VendorDirectory";
import VendorSettings from "./pages/VendorSettings";
import VendorDashboard from "./pages/VendorDashboard";
import AiChat from "./pages/AiChat";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";
import PlannerProfile from "./pages/PlannerProfile";
import PlannerDirectory from "./pages/PlannerDirectory";
import ResetPassword from "./pages/ResetPassword";
import AdminPortal from "./pages/AdminPortal";
import type { AppRole } from "@/lib/roles";

const queryClient = new QueryClient();

function ProtectedPage({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
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
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/planners" element={<PlannerDirectory />} />
              <Route path="/vendors-directory" element={<VendorDirectory />} />
              <Route path="/planner/:id" element={<PlannerProfile />} />
              <Route path="/clients" element={<ProtectedPage allowedRoles={['planner']}><PlannerDashboard /></ProtectedPage>} />
              <Route path="/dashboard" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Dashboard /></ProtectedPage>} />
              <Route path="/budget" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Budget /></ProtectedPage>} />
              <Route path="/tasks" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Tasks /></ProtectedPage>} />
              <Route path="/guests" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Guests /></ProtectedPage>} />
              <Route path="/vendors" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Vendors /></ProtectedPage>} />
              <Route path="/vendor-dashboard" element={<ProtectedPage allowedRoles={['vendor']}><VendorDashboard /></ProtectedPage>} />
              <Route path="/vendor-settings" element={<ProtectedPage allowedRoles={['vendor']}><VendorSettings /></ProtectedPage>} />
              <Route path="/ai-chat" element={<ProtectedPage allowedRoles={['couple', 'planner']}><AiChat /></ProtectedPage>} />
              <Route path="/admin" element={<ProtectedPage allowedRoles={['admin']}><AdminPortal /></ProtectedPage>} />
              <Route path="/settings" element={<ProtectedPage allowedRoles={['couple', 'planner', 'vendor', 'admin']}><ProfileSettings /></ProtectedPage>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PlannerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
