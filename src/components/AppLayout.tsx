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
import { getHomeRouteForRole, type PlannerType } from '@/lib/roles';
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, baseProfile, isSuperAdmin, rolePreview, setRolePreview } = useAuth();
  const { isPlanner, selectedClient, selectClient } = usePlanner();
  const { vendorRequestCount, plannerRequestCount } = useNotifications();

  const isAdmin = profile?.role === 'admin';
  const isVendor = profile?.role === 'vendor';
  const navItems = isAdmin ? adminNavItems : isVendor ? vendorNavItems : isPlanner ? plannerNavItems : coupleNavItems;

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
    await signOut();
    window.location.assign('/');
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
        fixed inset-y-0 left-0 z-50 w-64 overflow-hidden border-r border-white/10
        bg-[linear-gradient(180deg,hsla(var(--sidebar-background),0.78),hsla(var(--sidebar-background),0.58))]
        text-sidebar-foreground shadow-[0_20px_60px_rgba(20,12,10,0.28)] backdrop-blur-2xl
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_28%,rgba(255,255,255,0.03))]" />
        <div className="relative flex h-full flex-col bg-black/5">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-6 py-5">
            <Heart className="h-6 w-6 text-sidebar-primary" fill="currentColor" />
            <span className="font-display text-lg font-semibold text-sidebar-foreground">Zania</span>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground/80 hover:text-sidebar-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {profile && (
            <div className="border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-6">
              <p className="text-sm font-medium text-sidebar-foreground">{profile.full_name || 'Welcome!'}</p>
              <p className="text-xs text-sidebar-foreground/65 capitalize">
                {profile.role} Account
                {isSuperAdmin && rolePreview !== 'admin' ? ` · previewing as ${rolePreview}` : ''}
              </p>
              {isSuperAdmin && baseProfile && (
                <p className="mt-1 text-[11px] text-sidebar-foreground/55">
                  Signed in as {baseProfile.full_name || baseProfile.role}
                </p>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
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
                        : 'border border-white/10 bg-white/[0.06] text-sidebar-foreground/75 hover:bg-white/[0.1] hover:text-sidebar-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/50">
                Preview keeps your real admin account intact while the app routes and gates like the selected role.
              </p>
            </div>
          )}

          {/* Planner client indicator */}
          {isPlanner && selectedClient && (
            <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <button
                onClick={() => { selectClient(null); navigate('/clients'); }}
                className="flex w-full items-center gap-2 text-xs text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to clients
              </button>
              <p className="text-sm font-medium text-sidebar-primary mt-1 truncate">
                {selectedClient.client_name}{selectedClient.partner_name ? ` & ${selectedClient.partner_name}` : ''}
              </p>
            </div>
          )}

          <nav className="flex-1 space-y-1 px-3 py-4">
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
                    flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-all
                    ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                    ${isActive
                      ? 'border-white/10 bg-white/[0.14] text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_24px_rgba(15,8,6,0.18)]'
                      : 'text-sidebar-foreground/72 hover:border-white/10 hover:bg-white/[0.08] hover:text-sidebar-foreground'
                    }
                  `}
                >
                  <item.icon className="h-4.5 w-4.5" />
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

          <div className="border-t border-white/10 bg-white/[0.04] p-3">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/72 transition-all hover:border-white/10 hover:bg-white/[0.08] hover:text-sidebar-foreground"
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
