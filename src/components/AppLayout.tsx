import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type RolePreview } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, CheckSquare, Users, Store,
  MessageSquare, Settings, LogOut, Menu, X, Heart, Briefcase, ArrowLeft, Clock, BookHeart, ShieldCheck, Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getHomeRouteForRole, isProfessionalSetupPending, type PlannerType } from '@/lib/roles';
import AssistantPanel from '@/components/AssistantPanel';
import { AssistantPanelProvider } from '@/contexts/AssistantPanelContext';

const coupleNavItems = [
  { path: '/dashboard', label: 'Wedding Home', icon: LayoutDashboard },
  { path: '/budget', label: 'Budget', icon: Wallet },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/guests', label: 'Guests', icon: Users },
  { path: '/gift-registry', label: 'Gift Registry', icon: Gift },
  { path: '/vendors', label: 'Vendors', icon: Store },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/portfolio', label: 'Portfolio', icon: BookHeart },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const plannerNavItems = [
  { path: '/clients', label: 'My Weddings', icon: Briefcase },
  { path: '/dashboard', label: 'Wedding Home', icon: LayoutDashboard },
  { path: '/budget', label: 'Budget', icon: Wallet },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/guests', label: 'Guests', icon: Users },
  { path: '/gift-registry', label: 'Gift Registry', icon: Gift },
  { path: '/vendors', label: 'Vendors', icon: Store },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/portfolio', label: 'Portfolio', icon: BookHeart },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const vendorNavItems = [
  { path: '/vendor-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vendor-settings', label: 'My Listing', icon: Store },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const adminNavItems = [
  { path: '/admin', label: 'Admin Portal', icon: ShieldCheck },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const professionalSetupNavItems = [
  { path: '/settings', label: 'Complete Setup', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, profile, baseProfile, isSuperAdmin, rolePreview, setRolePreview } = useAuth();
  const { isPlanner, selectedClient, selectClient } = usePlanner();
  const { vendorRequestCount, plannerRequestCount } = useNotifications();

  const isAdmin = profile?.role === 'admin';
  const isVendor = profile?.role === 'vendor';
  const professionalSetupPending = isProfessionalSetupPending(user?.user_metadata ?? null, profile?.role, user?.email ?? null);
  const navItems = professionalSetupPending
    ? professionalSetupNavItems
    : isAdmin
      ? adminNavItems
      : isVendor
        ? vendorNavItems
        : isPlanner
          ? plannerNavItems
          : coupleNavItems;

  // Map paths to badge counts
  const badgeCounts: Record<string, number> = {};
  if (isVendor) {
    badgeCounts['/vendor-dashboard'] = vendorRequestCount;
  }
  if (isPlanner) {
    badgeCounts['/clients'] = plannerRequestCount;
  }

  // For planners, disable planning pages if no client selected (except /clients and /settings)
  const needsClient = isPlanner && !selectedClient;
  const planningPaths = ['/dashboard', '/budget', '/tasks', '/guests', '/gift-registry', '/vendors', '/timeline', '/portfolio'];

  const previewOptions: Array<{ value: RolePreview; label: string }> = [
    { value: 'admin', label: 'Admin' },
    { value: 'couple', label: 'Couple' },
    { value: 'planner', label: 'Planner' },
    { value: 'committee', label: 'Committee' },
    { value: 'vendor', label: 'Vendor' },
  ];

  const handlePreviewSwitch = (nextRole: RolePreview) => {
    setRolePreview(nextRole);
    setSidebarOpen(false);

    if (nextRole === 'admin') {
      if (selectedClient) selectClient(null);
      navigate('/admin');
      return;
    }

    if (nextRole === 'planner') {
      navigate('/clients');
      return;
    }

    if (nextRole === 'committee') {
      navigate('/dashboard');
      return;
    }

    if (nextRole === 'vendor') {
      navigate('/vendor-settings');
      return;
    }

    navigate(getHomeRouteForRole('couple'));
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed, forcing navigation to auth entry point:', error);
    } finally {
      window.location.assign('/auth');
    }
  };

  return (
    <AssistantPanelProvider>
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 overflow-hidden border-r border-white/15
        bg-[linear-gradient(180deg,rgba(41,24,20,0.94),rgba(57,33,27,0.92)_42%,rgba(73,44,36,0.88))]
        text-sidebar-foreground shadow-[0_28px_80px_rgba(20,12,10,0.38)] backdrop-blur-2xl
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(233,154,108,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_22%,rgba(255,255,255,0.03)_46%,rgba(0,0,0,0.12))]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/10" />
        <div className="relative flex h-full flex-col bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(255,255,255,0.02))]">
          <div className="flex items-center gap-2 border-b border-white/12 bg-white/[0.08] px-6 py-5">
            <Heart className="h-6 w-6 text-sidebar-primary" fill="currentColor" />
            <span className="font-display text-lg font-semibold tracking-[0.01em] text-white">Zania</span>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/85 hover:text-white lg:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>

          {profile && (
            <div className="border-b border-white/12 bg-white/[0.06] px-4 py-4 sm:px-6">
              <p className="text-sm font-semibold text-white">{profile.full_name || 'Welcome!'}</p>
              <p className="text-xs font-medium text-white/74 capitalize">
                {professionalSetupPending ? 'Professional Account' : `${profile.role} Account`}
                {isSuperAdmin && rolePreview !== 'admin' ? ` · previewing as ${rolePreview}` : ''}
              </p>
              {isSuperAdmin && baseProfile && (
                <p className="mt-1 text-[11px] text-white/58">
                  Signed in as {baseProfile.full_name || baseProfile.role}
                </p>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <div className="border-b border-white/12 bg-white/[0.05] px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Admin role preview
              </p>
              <div className="flex flex-wrap gap-2">
                {previewOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePreviewSwitch(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      rolePreview === option.value
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_20px_rgba(216,106,63,0.32)]'
                        : 'border border-white/12 bg-black/10 text-white/84 hover:bg-white/[0.14] hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-white/56">
                Preview keeps your real admin account intact while the app routes and gates like the selected role.
              </p>
            </div>
          )}

          {/* Planner client indicator */}
          {isPlanner && selectedClient && (
            <div className="border-b border-white/12 bg-white/[0.05] px-4 py-3">
              <button
                onClick={() => { selectClient(null); navigate('/clients'); }}
                className="flex w-full items-center gap-2 text-xs font-medium text-white/80 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to clients
              </button>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {selectedClient.client_name}{selectedClient.partner_name ? ` & ${selectedClient.partner_name}` : ''}
              </p>
            </div>
          )}

          <nav className="flex-1 space-y-1.5 px-3 py-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const disabled = needsClient && planningPaths.includes(item.path);
              return (
                <Link
                  key={item.path}
                  to={disabled ? '#' : item.path}
                  onClick={(e) => {
                    if (disabled) { e.preventDefault(); return; }
                    setSidebarOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all
                    ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                    ${isActive
                      ? 'border-primary/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.1))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_12px_28px_rgba(15,8,6,0.24)]'
                      : 'border-transparent bg-black/[0.12] text-white/90 hover:border-white/10 hover:bg-white/[0.12] hover:text-white'
                    }
                  `}
                >
                  <item.icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary' : 'text-white/80'}`} />
                  <span className="flex-1">{item.label}</span>
                  {(badgeCounts[item.path] || 0) > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {badgeCounts[item.path]}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/12 bg-white/[0.06] p-3">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-black/[0.12] px-3 py-2.5 text-sm font-medium text-white/90 transition-all hover:border-white/12 hover:bg-white/[0.12] hover:text-white"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="font-display text-base font-semibold">Zania</span>
          </div>
          {isPlanner && selectedClient && (
            <Badge variant="outline" className="ml-auto text-xs truncate max-w-[120px]">
              {selectedClient.client_name}
            </Badge>
          )}
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {isSuperAdmin && (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Admin preview mode
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Viewing as {rolePreview}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your real database account stays admin. We’re only switching the in-app experience for testing.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={rolePreview === option.value ? 'default' : 'outline'}
                      onClick={() => handlePreviewSwitch(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {children}
          <AssistantPanel role={profile?.role} plannerType={profile?.planner_type as PlannerType | null | undefined} />
        </div>
      </main>
    </div>
    </AssistantPanelProvider>
  );
}
