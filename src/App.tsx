import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlannerProvider } from "@/contexts/PlannerContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import type { AppRole } from "@/lib/roles";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PlannerDashboard = lazy(() => import("./pages/PlannerDashboard"));
const Budget = lazy(() => import("./pages/Budget"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Guests = lazy(() => import("./pages/Guests"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDirectory = lazy(() => import("./pages/VendorDirectory"));
const VendorSettings = lazy(() => import("./pages/VendorSettings"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const AiChat = lazy(() => import("./pages/AiChat"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PlannerProfile = lazy(() => import("./pages/PlannerProfile"));
const PlannerDirectory = lazy(() => import("./pages/PlannerDirectory"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const TimelinePage = lazy(() => import("./pages/Timeline"));
const TimelineShare = lazy(() => import("./pages/TimelineShare"));
const GuestRsvp = lazy(() => import("./pages/GuestRsvp"));
const WeddingPortfolio = lazy(() => import("./pages/WeddingPortfolio"));
const ManagePortfolio = lazy(() => import("./pages/ManagePortfolio"));

const queryClient = new QueryClient();

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <p className="font-display text-2xl font-semibold text-foreground">Opening wedding workspace...</p>
        <p className="mt-2 text-sm text-muted-foreground">Loading only the part of the app you need.</p>
      </div>
    </div>
  );
}

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
            <NotificationProvider>
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
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
                  <Route path="/timeline" element={<ProtectedPage allowedRoles={['couple', 'planner']}><TimelinePage /></ProtectedPage>} />
                  <Route path="/timeline/share/:token" element={<TimelineShare />} />
                  <Route path="/rsvp/:token" element={<GuestRsvp />} />
                  <Route path="/wedding/:token" element={<WeddingPortfolio />} />
                  <Route path="/portfolio" element={<ProtectedPage allowedRoles={['couple', 'planner']}><ManagePortfolio /></ProtectedPage>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </NotificationProvider>
          </PlannerProvider>
        </AuthProvider>
      </BrowserRouter>
      <SpeedInsights />
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
