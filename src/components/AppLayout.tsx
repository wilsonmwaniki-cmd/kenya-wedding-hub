import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, CheckSquare, Users, Store,
  MessageSquare, Settings, LogOut, Menu, X, Heart, Briefcase, ArrowLeft, Clock, BookHeart, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const coupleNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/budget', label: 'Budget', icon: Wallet },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/guests', label: 'Guests', icon: Users },
  { path: '/vendors', label: 'Vendors', icon: Store },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/portfolio', label: 'Portfolio', icon: BookHeart },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const plannerNavItems = [
  { path: '/clients', label: 'My Clients', icon: Briefcase },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/budget', label: 'Budget', icon: Wallet },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/guests', label: 'Guests', icon: Users },
  { path: '/vendors', label: 'Vendors', icon: Store },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/portfolio', label: 'Portfolio', icon: BookHeart },
  { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const vendorNavItems = [
  { path: '/vendor-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vendor-settings', label: 'My Listing', icon: Store },
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
  const { signOut, profile } = useAuth();
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
  const planningPaths = ['/dashboard', '/budget', '/tasks', '/guests', '/vendors', '/timeline', '/portfolio'];

  const handleSignOut = async () => {
    await signOut();
    window.location.assign('/');
  };

  return (
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
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground 
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
            <Heart className="h-6 w-6 text-sidebar-primary" fill="currentColor" />
            <span className="font-display text-lg font-semibold text-sidebar-foreground">The Wedding Control Room</span>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {profile && (
            <div className="border-b border-sidebar-border px-6 py-4">
              <p className="text-sm font-medium text-sidebar-foreground">{profile.full_name || 'Welcome!'}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{profile.role} Account</p>
            </div>
          )}

          {/* Planner client indicator */}
          {isPlanner && selectedClient && (
            <div className="border-b border-sidebar-border px-4 py-3">
              <button
                onClick={() => { selectClient(null); navigate('/clients'); }}
                className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors w-full"
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
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                    ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                    ${isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
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

          <div className="border-t border-sidebar-border p-3">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="font-display text-base font-semibold">WeddingPlan</span>
          </div>
          {isPlanner && selectedClient && (
            <Badge variant="outline" className="ml-auto text-xs truncate max-w-[120px]">
              {selectedClient.client_name}
            </Badge>
          )}
        </header>
        <div className="flex-1 p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
