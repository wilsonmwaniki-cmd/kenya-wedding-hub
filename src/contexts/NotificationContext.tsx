import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface NotificationContextType {
  vendorRequestCount: number;
  plannerRequestCount: number;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  vendorRequestCount: 0,
  plannerRequestCount: 0,
  refresh: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [vendorRequestCount, setVendorRequestCount] = useState(0);
  const [plannerRequestCount, setPlannerRequestCount] = useState(0);

  const refresh = async () => {
    if (!user || !profile) return;

    if (profile.role === 'vendor') {
      // Count pending vendor connection requests to this vendor's listings
      const { data: listings } = await supabase
        .from('vendor_listings')
        .select('id')
        .eq('user_id', user.id);
      if (listings?.length) {
        const listingIds = listings.map(l => l.id);
        const { count } = await supabase
          .from('vendor_connection_requests')
          .select('id', { count: 'exact', head: true })
          .in('vendor_listing_id', listingIds)
          .eq('status', 'pending');
        setVendorRequestCount(count || 0);
      } else {
        setVendorRequestCount(0);
      }
    }

    if (profile.role === 'planner') {
      // Count pending planner link requests
      const { count } = await supabase
        .from('planner_link_requests')
        .select('id', { count: 'exact', head: true })
        .eq('planner_user_id', user.id)
        .eq('status', 'pending');
      setPlannerRequestCount(count || 0);
    }
  };

  useEffect(() => {
    refresh();
  }, [user, profile]);

  // Subscribe to realtime changes for instant updates
  useEffect(() => {
    if (!user || !profile) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (profile.role === 'vendor') {
      const ch = supabase
        .channel('vendor-notifications')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'vendor_connection_requests',
        }, () => refresh())
        .subscribe();
      channels.push(ch);
    }

    if (profile.role === 'planner') {
      const ch = supabase
        .channel('planner-notifications')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'planner_link_requests',
        }, () => refresh())
        .subscribe();
      channels.push(ch);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [user, profile]);

  return (
    <NotificationContext.Provider value={{ vendorRequestCount, plannerRequestCount, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
