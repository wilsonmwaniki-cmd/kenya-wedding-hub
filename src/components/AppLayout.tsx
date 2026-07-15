import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type RolePreview } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard, Wallet, CheckSquare, Users, Store,
  MessageSquare, Settings, LogOut, Menu, X, Briefcase, ArrowLeft, Clock, BookHeart, ShieldCheck, Gift, HandCoins, NotebookPen, ChevronDown, HeartHandshake, FlaskConical, Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getHomeRouteForRole, isProfessionalSetupPending, type PlannerType } from '@/lib/roles';
import { AssistantPanelProvider, useAssistantPanel } from '@/contexts/AssistantPanelContext';
import BrandWordmark from '@/components/BrandWordmark';
import AccountReviewBanner from '@/components/AccountReviewBanner';
import { getLabsPath, getProfessionalNetworkPath, getSpaceTablePlanPath, isProfessionalNetworkEnabled, isSpaceTablePlanEnabled } from '@/lib/featureFlags';

const AssistantPanel = lazy(() => import('@/components/AssistantPanel'));

const SIDEBAR_EXPANSION_KEY = 'zania:sidebar-expanded';
const SIDEBAR_SCROLL_KEY = 'zania:sidebar-scroll';

function readExpandedNavItems() {
  if (typeof window === 'undefined') return {};

  try {
    return JSON.parse(window.sessionStorage.getItem(SIDEBAR_EXPANSION_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

type NavItem = {
  path: string;
  label: string;
  icon: any;
  children?: Array<{ path: string; label: string }>;
};

const coupleNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Wedding Home', icon: LayoutDashboard },
  { path: '/budget', label: 'Budget', icon: Wallet },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/guests', label: 'Guests', icon: Users },
  { path: '/contributions', label: 'Contributions', icon: HandCoins },
  { path: '/gift-registry', label: 'Gift Registry', icon: Gift },
  { path: '/vendors', label: 'Vendors', icon: Store },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/portfolio', label: 'Portfolio', icon: BookHeart },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const plannerNavItems: NavItem[] = [
  { path: '/clients', label: 'My Weddings', icon: Briefcase },
  {
    path: '/planner-documents',
    label: 'Documents',
    icon: NotebookPen,
    children: [
      { path: '/planner-documents', label: 'Overview' },
      { path: '/planner-documents/quotes', label: 'Quotes' },
      { path: '/planner-documents/invoices', label: 'Invoices' },
      { path: '/planner-documents/receipts', label: 'Receipts' },
      { path: '/planner-documents/contracts', label: 'Contracts' },
      { path: '/planner-documents/templates', label: 'Templates' },
    ],
  },
  { path: '/dashboard', label: 'Wedding Home', icon: LayoutDashboard },
  { path: '/budget', label: 'Budget', icon: Wallet },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/guests', label: 'Guests', icon: Users },
  { path: '/contributions', label: 'Contributions', icon: HandCoins },
  { path: '/gift-registry', label: 'Gift Registry', icon: Gift },
  { path: '/vendors', label: 'Vendors', icon: Store },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/portfolio', label: 'Portfolio', icon: BookHeart },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const vendorNavItems: NavItem[] = [
  { path: '/vendor-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    path: '/vendor-documents',
    label: 'Documents',
    icon: NotebookPen,
    children: [
      { path: '/vendor-documents', label: 'Overview' },
      { path: '/vendor-documents/quotes', label: 'Quotes' },
      { path: '/vendor-documents/invoices', label: 'Invoices' },
      { path: '/vendor-documents/receipts', label: 'Receipts' },
      { path: '/vendor-documents/contracts', label: 'Contracts' },
      { path: '/vendor-documents/templates', label: 'Templates' },
    ],
  },
  { path: '/vendor-settings', label: 'My Listing', icon: Store },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const adminNavItems: NavItem[] = [
  { path: '/admin', label: 'Admin Portal', icon: ShieldCheck },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const professionalSetupNavItems: NavItem[] = [
  { path: '/settings', label: 'Complete Setup', icon: Settings },
];

function AssistantPanelSlot({
  role,
  plannerType,
}: {
  role?: string | null;
  plannerType?: PlannerType | null;
}) {
  const assistantPanel = useAssistantPanel();

  if (!assistantPanel?.open && !assistantPanel?.launchRequest) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AssistantPanel role={role} plannerType={plannerType} />
    </Suspense>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedNavItems, setExpandedNavItems] = useState<Record<string, boolean>>(readExpandedNavItems);
  const navScrollRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    window.sessionStorage.setItem(SIDEBAR_EXPANSION_KEY, JSON.stringify(expandedNavItems));
  }, [expandedNavItems]);

  useEffect(() => {
    const nav = navScrollRef.current;
    if (!nav) return;

    const savedPosition = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? 0);
    nav.scrollTop = Number.isFinite(savedPosition) ? savedPosition : 0;
  }, []);
  const { user, signOut, profile, baseProfile, isSuperAdmin, rolePreview, setRolePreview } = useAuth();
  const { isPlanner, selectedClient, selectClient, plannerClientHydrating } = usePlanner();
  const { vendorRequestCount, plannerRequestCount } = useNotifications();

  const professionalNetworkEnabled = isProfessionalNetworkEnabled();
  const spaceTablePlanEnabled = isSpaceTablePlanEnabled();
  const labsEnabled = professionalNetworkEnabled;
  const professionalNetworkNavItem: NavItem = {
    path: getProfessionalNetworkPath(),
    label: 'Network',
    icon: HeartHandshake,
  };
  const spaceTablePlanNavItem: NavItem = {
    path: getSpaceTablePlanPath(),
    label: 'Space Plan',
    icon: Map,
  };
  const labsNavItem: NavItem = {
    path: getLabsPath(),
    label: 'Labs',
    icon: FlaskConical,
  };
  const isAdmin = profile?.role === 'admin';
  const isVendor = profile?.role === 'vendor';
  const professionalSetupPending = isProfessionalSetupPending(user?.user_metadata ?? null, profile?.role, user?.email ?? null);
  const previewNavItems: NavItem[] = [];

  if (professionalNetworkEnabled && (isPlanner || isVendor)) {
    previewNavItems.push(professionalNetworkNavItem);
  }

  if (spaceTablePlanEnabled && (isPlanner || (!isAdmin && !isVendor))) {
    previewNavItems.push(spaceTablePlanNavItem);
  }

  if (labsEnabled && (!isAdmin && !professionalSetupPending)) {
    previewNavItems.push(labsNavItem);
  }

  const navItems = professionalSetupPending
    ? professionalSetupNavItems
    : isAdmin
      ? adminNavItems
      : isVendor
        ? [...vendorNavItems.slice(0, 2), ...previewNavItems, ...vendorNavItems.slice(2)]
        : isPlanner
          ? [...plannerNavItems.slice(0, 9), ...previewNavItems, ...plannerNavItems.slice(9)]
          : [...coupleNavItems.slice(0, 7), ...previewNavItems, ...coupleNavItems.slice(7)];

  // Map paths to badge counts
  const badgeCounts: Record<string, number> = {};
  if (isVendor) {
    badgeCounts['/vendor-dashboard'] = vendorRequestCount;
  }
  if (isPlanner) {
    badgeCounts['/clients'] = plannerRequestCount;
  }

  // For planners, disable planning pages if no client selected (except /clients and /settings)
  const needsClient = isPlanner && !plannerClientHydrating && !selectedClient;
  const planningPaths = ['/dashboard', '/budget', '/tasks', '/guests', '/contributions', '/gift-registry', '/vendors', '/timeline', '/portfolio'];

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
      window.location.assign('/sign-in');
    }
  };

  useEffect(() => {
    setExpandedNavItems((current) => {
      let changed = false;
      const next = { ...current };

      navItems.forEach((item) => {
        if (!item.children?.length) return;
        const shouldBeOpen = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        if (shouldBeOpen && !next[item.path]) {
          next[item.path] = true;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [location.pathname, navItems]);

  return (
    <AssistantPanelProvider>
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(212,118,70,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(212,187,125,0.12),transparent_26%),linear-gradient(180deg,#fbf7f1_0%,#f7f1e8_42%,#f5ede2_100%)]">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/18 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 h-[100dvh] w-[17.5rem] overflow-hidden border-r border-white/15 sm:w-[18rem] lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:self-start lg:w-[clamp(14.5rem,18vw,17.5rem)] xl:w-[18rem]
        bg-[linear-gradient(180deg,rgba(34,20,17,0.97),rgba(53,31,26,0.95)_36%,rgba(76,47,38,0.92))]
        text-sidebar-foreground shadow-[0_28px_80px_rgba(20,12,10,0.38)] backdrop-blur-2xl
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(233,154,108,0.26),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.09),transparent_22%),radial-gradient(circle_at_top_right,rgba(212,187,125,0.14),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_22%,rgba(255,255,255,0.03)_46%,rgba(0,0,0,0.14))]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/10" />
        <div className="relative flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(255,255,255,0.02))]">
          <div className="border-b border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] px-6 py-5">
            <div className="flex items-center gap-2">
              <BrandWordmark light size="sm" />
              <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/85 hover:text-white lg:hidden">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 h-px w-20 bg-[#d4bb7d]/80" />
            <p className="mt-3 text-[11px] uppercase tracking-[0.34em] text-white/50">
              Kenya & diaspora planning
            </p>
          </div>

          {profile && (
            <div className="border-b border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] px-4 py-4 sm:px-6">
              <p className="truncate text-sm font-semibold text-white">{profile.full_name || 'Welcome!'}</p>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d9c4a2]/80">
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

          <nav
            ref={navScrollRef}
            onScroll={(event) => window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(event.currentTarget.scrollTop))}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [-webkit-overflow-scrolling:touch]"
          >
            <div className="space-y-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              const disabled = needsClient && planningPaths.includes(item.path);
              const hasChildren = Boolean(item.children?.length);
              const isExpanded = expandedNavItems[item.path] ?? isActive;
              return (
                <div key={item.path} className="space-y-1">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (disabled) return;
                        setExpandedNavItems((current) => ({
                          ...current,
                          [item.path]: !(current[item.path] ?? isActive),
                        }));
                      }}
                      className={`
                        ease-zania relative isolate flex w-full items-center gap-3 overflow-hidden rounded-[1.15rem] border px-4 py-3 text-left text-sm font-medium transition-[color,border-color,background-color,transform] duration-200 active:scale-[0.985] motion-reduce:transition-none lg:px-3 lg:py-2.5
                        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                        ${isActive
                          ? 'border-primary/45 bg-transparent text-white'
                          : 'border-transparent bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(255,255,255,0.03))] text-white/90 hover:border-white/10 hover:bg-white/[0.12] hover:text-white'
                        }
                      `}
                    >
                      {isActive ? (
                        <motion.span
                          layoutId="zania-sidebar-active"
                          className="absolute inset-0 z-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_16px_32px_rgba(15,8,6,0.24)]"
                          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        />
                      ) : null}
                      <item.icon className={`relative z-10 h-4.5 w-4.5 transition-colors duration-200 ${isActive ? 'text-primary' : 'text-white/80'}`} />
                      <span className="relative z-10 min-w-0 flex-1 truncate">{item.label}</span>
                      {(badgeCounts[item.path] || 0) > 0 && (
                        <span
                          className="relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-info/30 bg-info/15 px-1.5 text-[10px] font-bold text-info"
                          aria-label={`${badgeCounts[item.path]} new ${item.label.toLowerCase()} notification${badgeCounts[item.path] === 1 ? '' : 's'}`}
                        >
                          {badgeCounts[item.path]}
                        </span>
                      )}
                      <ChevronDown className={`relative z-10 h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? 'rotate-180 text-white/80' : 'text-white/55'}`} />
                    </button>
                  ) : (
                    <Link
                      to={disabled ? '#' : item.path}
                      onClick={(e) => {
                        if (disabled) { e.preventDefault(); return; }
                        setSidebarOpen(false);
                      }}
                      className={`
                        ease-zania relative isolate flex items-center gap-3 overflow-hidden rounded-[1.15rem] border px-4 py-3 text-sm font-medium transition-[color,border-color,background-color,transform] duration-200 active:scale-[0.985] motion-reduce:transition-none lg:px-3 lg:py-2.5
                        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                        ${isActive
                          ? 'border-primary/45 bg-transparent text-white'
                          : 'border-transparent bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(255,255,255,0.03))] text-white/90 hover:border-white/10 hover:bg-white/[0.12] hover:text-white'
                        }
                      `}
                    >
                      {isActive ? (
                        <motion.span
                          layoutId="zania-sidebar-active"
                          className="absolute inset-0 z-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_16px_32px_rgba(15,8,6,0.24)]"
                          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        />
                      ) : null}
                      <item.icon className={`relative z-10 h-4.5 w-4.5 transition-colors duration-200 ${isActive ? 'text-primary' : 'text-white/80'}`} />
                      <span className="relative z-10 min-w-0 flex-1 truncate">{item.label}</span>
                      {(badgeCounts[item.path] || 0) > 0 && (
                        <span
                          className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full border border-info/30 bg-info/15 px-1.5 text-[10px] font-bold text-info"
                          aria-label={`${badgeCounts[item.path]} new ${item.label.toLowerCase()} notification${badgeCounts[item.path] === 1 ? '' : 's'}`}
                        >
                          {badgeCounts[item.path]}
                        </span>
                      )}
                    </Link>
                  )}
                  <AnimatePresence initial={false}>
                  {hasChildren && isExpanded ? (
                    <motion.div
                      key={`${item.path}-children`}
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -4 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-1 overflow-hidden pl-4 motion-reduce:transition-none"
                    >
                      {item.children.map((child) => {
                        const childActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`relative block rounded-lg px-3 py-2 text-sm transition-[color,background-color,transform] duration-150 active:scale-[0.985] motion-reduce:transition-none ${
                              childActive
                                ? 'bg-white/[0.12] text-white'
                                : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </motion.div>
                  ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
            </div>
          </nav>

          <div className="shrink-0 border-t border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-[1.15rem] border border-transparent bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(255,255,255,0.03))] px-4 py-3 text-sm font-medium text-white/90 transition-[color,border-color,background-color,transform] duration-200 hover:border-white/12 hover:bg-white/[0.12] hover:text-white active:scale-[0.985] motion-reduce:transition-none"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-h-screen flex-1 flex-col bg-[radial-gradient(circle_at_top,rgba(227,144,100,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,244,237,0.96))]">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#eadbca] bg-[linear-gradient(180deg,rgba(255,251,247,0.96),rgba(248,241,232,0.92))] px-4 py-3 shadow-[0_10px_30px_rgba(28,22,18,0.04)] backdrop-blur-sm lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((open) => !open)}
            className="relative z-10 h-11 w-11 touch-manipulation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <BrandWordmark size="sm" />
          {isPlanner && selectedClient && (
            <Badge variant="outline" className="ml-auto text-xs truncate max-w-[120px]">
              {selectedClient.client_name}
            </Badge>
          )}
        </header>
        <div className="flex-1 p-4 pb-28 sm:p-6 sm:pb-32 lg:p-8 lg:pb-36">
          {isSuperAdmin && (
            <div className="mb-6 rounded-[26px] border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(227,144,100,0.16),transparent_28%),linear-gradient(180deg,rgba(255,251,247,0.95),rgba(250,244,236,0.92))] px-4 py-4 shadow-[0_18px_42px_rgba(28,22,18,0.06)]">
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
          <div className="mx-auto w-full max-w-[1680px]" data-page-shell>
            <AccountReviewBanner />
            {children}
          </div>
          <AssistantPanelSlot
            role={profile?.role}
            plannerType={profile?.planner_type as PlannerType | null | undefined}
          />
        </div>
      </main>
    </div>
    </AssistantPanelProvider>
  );
}
