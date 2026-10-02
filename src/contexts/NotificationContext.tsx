import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  listAttentionItems,
  setAttentionItemState,
  type AttentionItem,
  type AttentionStatus,
} from '@/lib/attention';

interface NotificationContextType {
  vendorRequestCount: number;
  plannerRequestCount: number;
  attentionItems: AttentionItem[];
  unreadAttentionCount: number;
  attentionLoading: boolean;
  refresh: () => Promise<void>;
  updateAttentionState: (
    attentionId: string,
    status: Extract<AttentionStatus, 'read' | 'completed' | 'dismissed'>,
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  vendorRequestCount: 0,
  plannerRequestCount: 0,
  attentionItems: [],
  unreadAttentionCount: 0,
  attentionLoading: false,
  refresh: async () => {},
  updateAttentionState: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [vendorRequestCount, setVendorRequestCount] = useState(0);
  const [plannerRequestCount, setPlannerRequestCount] = useState(0);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [attentionLoading, setAttentionLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !profile) {
      setVendorRequestCount(0);
      setPlannerRequestCount(0);
      setAttentionItems([]);
      return;
    }

    setAttentionLoading(true);
    try {
      const items = await listAttentionItems();
      setAttentionItems(items);

      if (profile.role === 'vendor') {
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
      } else {
        setVendorRequestCount(0);
      }

      if (profile.role === 'planner') {
        const { count } = await supabase
          .from('planner_link_requests')
          .select('id', { count: 'exact', head: true })
          .eq('planner_user_id', user.id)
          .eq('status', 'pending');
        setPlannerRequestCount(count || 0);
      } else {
        setPlannerRequestCount(0);
      }
    } catch (error) {
      console.error('Unable to refresh attention items', error);
    } finally {
      setAttentionLoading(false);
    }
  }, [profile, user]);

  const updateAttentionState: NotificationContextType['updateAttentionState'] = async (attentionId, status) => {
    const previousItems = attentionItems;
    setAttentionItems((current) => status === 'read'
      ? current.map((item) => item.id === attentionId ? { ...item, status: 'read' } : item)
      : current.filter((item) => item.id !== attentionId));

    try {
      await setAttentionItemState(attentionId, status);
    } catch (error) {
      setAttentionItems(previousItems);
      throw error;
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to realtime changes for instant updates
  useEffect(() => {
    if (!user || !profile) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];
    const attentionChannel = supabase
      .channel(`attention-items-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attention_items',
        filter: `recipient_user_id=eq.${user.id}`,
      }, () => void refresh())
      .subscribe();
    channels.push(attentionChannel);

    if (profile.role === 'vendor') {
      const ch = supabase
        .channel('vendor-notifications')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'vendor_connection_requests',
        }, () => void refresh())
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
        }, () => void refresh())
        .subscribe();
      channels.push(ch);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [profile, refresh, user]);

  const unreadAttentionCount = attentionItems.filter((item) => item.status === 'unread').length;

  return (
    <NotificationContext.Provider
      value={{
        vendorRequestCount,
        plannerRequestCount,
        attentionItems,
        unreadAttentionCount,
        attentionLoading,
        refresh,
        updateAttentionState,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
