import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { PublicErrorBoundary, WorkspaceErrorBoundary } from "@/components/AppErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import type { AppRole } from "@/lib/roles";
import LaunchFeature from "@/components/LaunchFeature";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PlannerDashboard = lazy(() => import("./pages/PlannerDashboard"));
const Budget = lazy(() => import("./pages/Budget"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Guests = lazy(() => import("./pages/Guests"));
const Contributions = lazy(() => import("./pages/Contributions"));
const ContributionsShare = lazy(() => import("./pages/ContributionsShare"));
const GiftRegistry = lazy(() => import("./pages/GiftRegistry"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDirectory = lazy(() => import("./pages/VendorDirectory"));
const VendorClaim = lazy(() => import("./pages/VendorClaim"));
const VendorProfile = lazy(() => import("./pages/VendorProfile"));
const VendorSettings = lazy(() => import("./pages/VendorSettings"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const VendorDocuments = lazy(() => import("./pages/VendorDocuments"));
const PlannerDocuments = lazy(() => import("./pages/PlannerDocuments"));
const CommercialDocumentPrint = lazy(() => import("./pages/CommercialDocumentPrint"));
const CommercialDocumentShare = lazy(() => import("./pages/CommercialDocumentShare"));
const ProfessionalContractShare = lazy(() => import("./pages/ProfessionalContractShare"));
const AiChat = lazy(() => import("./pages/AiChat"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PlannerProfile = lazy(() => import("./pages/PlannerProfile"));
const PlannerDirectory = lazy(() => import("./pages/PlannerDirectory"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const WeddingSetup = lazy(() => import("./pages/WeddingSetup"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const TimelinePage = lazy(() => import("./pages/Timeline"));
const TimelineShare = lazy(() => import("./pages/TimelineShare"));
const GuestRsvp = lazy(() => import("./pages/GuestRsvp"));
const WeddingPortfolio = lazy(() => import("./pages/WeddingPortfolio"));
const ManagePortfolio = lazy(() => import("./pages/ManagePortfolio"));
const SpaceTablePlan = lazy(() => import("./pages/SpaceTablePlan"));
const LabsIndex = lazy(() => import("./pages/LabsIndex"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ProfessionalNetwork = lazy(() => import("./pages/ProfessionalNetwork"));
const AppAnalytics = lazy(() => import("@/components/AppAnalytics"));
const AppLayout = lazy(() => import("@/components/AppLayout"));
const WorkspaceProviders = lazy(() => import("@/components/WorkspaceProviders"));

const queryClient = new QueryClient();

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-border/60 bg-card/80 px-5 py-3 shadow-sm backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/35" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary/75" />
          </span>
          <p className="font-display text-xl font-semibold text-foreground">Opening wedding workspace...</p>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
          <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/35" />
          <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/45 [animation-delay:120ms]" />
          <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/55 [animation-delay:240ms]" />
        </div>
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
      <WorkspaceErrorBoundary>
        <Suspense fallback={<RouteLoader />}>
          <WorkspaceProviders>
            <AppLayout>{children}</AppLayout>
          </WorkspaceProviders>
        </Suspense>
      </WorkspaceErrorBoundary>
    </ProtectedRoute>
  );
}

function ProtectedStandalonePage({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <WorkspaceErrorBoundary>{children}</WorkspaceErrorBoundary>
    </ProtectedRoute>
  );
}

function PublicPage({ children }: { children: React.ReactNode }) {
  return <PublicErrorBoundary>{children}</PublicErrorBoundary>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={null}>
            <AppAnalytics />
          </Suspense>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<PublicPage><Landing /></PublicPage>} />
              <Route path="/auth" element={<PublicPage><Auth /></PublicPage>} />
              <Route path="/sign-in" element={<PublicPage><Auth /></PublicPage>} />
              <Route path="/forgot-password" element={<PublicPage><Auth /></PublicPage>} />
              <Route path="/admin/login" element={<PublicPage><Auth /></PublicPage>} />
              <Route path="/auth/callback" element={<PublicPage><AuthCallback /></PublicPage>} />
              <Route path="/reset-password" element={<PublicPage><ResetPassword /></PublicPage>} />
              <Route path="/pricing" element={<PublicPage><Pricing /></PublicPage>} />
              <Route path="/privacy" element={<PublicPage><PrivacyPolicy /></PublicPage>} />
              <Route path="/terms" element={<PublicPage><TermsOfService /></PublicPage>} />
              <Route path="/planners" element={<PublicPage><PlannerDirectory /></PublicPage>} />
              <Route path="/vendors-directory" element={<PublicPage><VendorDirectory /></PublicPage>} />
              <Route path="/vendors-directory/collections/:slug" element={<PublicPage><VendorDirectory /></PublicPage>} />
              <Route path="/vendor/:id" element={<PublicPage><VendorProfile /></PublicPage>} />
              <Route path="/vendor-claim" element={<PublicPage><VendorClaim /></PublicPage>} />
              <Route path="/planner/:id" element={<PublicPage><PlannerProfile /></PublicPage>} />
              <Route path="/contributions/share/:token" element={<PublicPage><ContributionsShare /></PublicPage>} />
              <Route path="/documents/share/:token" element={<PublicPage><CommercialDocumentShare /></PublicPage>} />
              <Route path="/contracts/share/:token" element={<PublicPage><ProfessionalContractShare /></PublicPage>} />
              <Route path="/timeline/share/:token" element={<PublicPage><TimelineShare /></PublicPage>} />
              <Route path="/rsvp/:token" element={<PublicPage><GuestRsvp /></PublicPage>} />
              <Route path="/wedding/:token" element={<PublicPage><WeddingPortfolio /></PublicPage>} />
              <Route path="/wedding-setup" element={<ProtectedStandalonePage allowedRoles={['couple']}><WeddingSetup /></ProtectedStandalonePage>} />
              <Route path="/documents/:documentId/print" element={<ProtectedStandalonePage allowedRoles={['vendor', 'planner']}><CommercialDocumentPrint /></ProtectedStandalonePage>} />
              <Route path="/labs" element={<ProtectedPage allowedRoles={['planner', 'vendor']}><LabsIndex /></ProtectedPage>} />
              <Route path="/labs/network" element={<ProtectedPage allowedRoles={['planner', 'vendor']}><ProfessionalNetwork /></ProtectedPage>} />
              <Route path="/clients" element={<ProtectedPage allowedRoles={['planner']}><PlannerDashboard /></ProtectedPage>} />
              <Route path="/dashboard" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Dashboard /></ProtectedPage>} />
              <Route path="/budget" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Budget /></ProtectedPage>} />
              <Route path="/tasks" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Tasks /></ProtectedPage>} />
              <Route path="/guests" element={<ProtectedPage allowedRoles={['couple', 'planner']}><LaunchFeature path="/guests"><Guests /></LaunchFeature></ProtectedPage>} />
              <Route path="/contributions" element={<ProtectedPage allowedRoles={['couple', 'planner']}><LaunchFeature path="/contributions"><Contributions /></LaunchFeature></ProtectedPage>} />
              <Route path="/gift-registry" element={<ProtectedPage allowedRoles={['couple', 'planner']}><LaunchFeature path="/gift-registry"><GiftRegistry /></LaunchFeature></ProtectedPage>} />
              <Route path="/vendors" element={<ProtectedPage allowedRoles={['couple', 'planner']}><Vendors /></ProtectedPage>} />
              <Route path="/space-plan" element={<ProtectedPage allowedRoles={['couple', 'planner']}><LaunchFeature path="/space-plan"><SpaceTablePlan /></LaunchFeature></ProtectedPage>} />
              <Route path="/vendor-dashboard" element={<ProtectedPage allowedRoles={['vendor']}><VendorDashboard /></ProtectedPage>} />
              <Route path="/vendor-documents" element={<ProtectedPage allowedRoles={['vendor']}><VendorDocuments /></ProtectedPage>} />
              <Route path="/vendor-documents/:section" element={<ProtectedPage allowedRoles={['vendor']}><VendorDocuments /></ProtectedPage>} />
              <Route path="/planner-documents" element={<ProtectedPage allowedRoles={['planner']}><PlannerDocuments /></ProtectedPage>} />
              <Route path="/planner-documents/:section" element={<ProtectedPage allowedRoles={['planner']}><PlannerDocuments /></ProtectedPage>} />
              <Route path="/vendor-settings" element={<ProtectedPage allowedRoles={['vendor']}><VendorSettings /></ProtectedPage>} />
              <Route path="/ai-chat" element={<ProtectedPage allowedRoles={['couple', 'planner', 'vendor']}><LaunchFeature path="/ai-chat"><AiChat /></LaunchFeature></ProtectedPage>} />
              <Route path="/admin" element={<ProtectedPage allowedRoles={['admin']}><AdminPortal /></ProtectedPage>} />
              <Route path="/settings" element={<ProtectedPage allowedRoles={['couple', 'planner', 'vendor', 'admin']}><ProfileSettings /></ProtectedPage>} />
              <Route path="/timeline" element={<ProtectedPage allowedRoles={['couple', 'planner']}><LaunchFeature path="/timeline"><TimelinePage /></LaunchFeature></ProtectedPage>} />
              <Route path="/portfolio" element={<ProtectedPage allowedRoles={['couple', 'planner']}><LaunchFeature path="/portfolio"><ManagePortfolio /></LaunchFeature></ProtectedPage>} />
              <Route path="*" element={<PublicPage><NotFound /></PublicPage>} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
      <Analytics />
      <SpeedInsights />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
