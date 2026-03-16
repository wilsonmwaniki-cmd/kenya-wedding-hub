import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface PlannerClient {
  id: string;
  planner_user_id: string;
  client_name: string;
  partner_name: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  linked_user_id: string | null;
}

interface LinkedPlannerInfo {
  clientRecordId: string;
  plannerUserId: string;
  plannerName: string | null;
}

interface PlannerContextType {
  clients: PlannerClient[];
  selectedClient: PlannerClient | null;
  selectClient: (client: PlannerClient | null) => void;
  loadClients: () => Promise<void>;
  isPlanner: boolean;
  /** Returns filter info for queries */
  dataFilterKey: 'user_id' | 'client_id' | null;
  dataFilterValue: string | null;
  /** OR filter string for .or() queries — supports shared workspace */
  dataOrFilter: string | null;
  /** For couples: info about their linked planner */
  linkedPlanner: LinkedPlannerInfo | null;
  loadLinkedPlanner: () => Promise<void>;
  unlinkPlanner: () => Promise<void>;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [clients, setClients] = useState<PlannerClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<PlannerClient | null>(null);
  const [linkedPlanner, setLinkedPlanner] = useState<LinkedPlannerInfo | null>(null);

  const isCommittee = profile?.role === 'planner' && profile?.planner_type === 'committee';
  const isPlanner = profile?.role === 'planner' && !isCommittee;
  const isCouple = profile?.role === 'couple';

  const loadClients = async () => {
    if (!user || !isPlanner) return;
    const { data } = await supabase
      .from('planner_clients')
      .select('*')
      .eq('planner_user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setClients(data as PlannerClient[]);
  };

  const loadLinkedPlanner = async () => {
    if (!user || !isCouple) { setLinkedPlanner(null); return; }
    const { data } = await supabase
      .from('planner_clients')
      .select('id, planner_user_id')
      .eq('linked_user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (data) {
      // Fetch planner name
      const { data: plannerProfile } = await supabase
        .from('profiles')
        .select('full_name, company_name')
        .eq('user_id', data.planner_user_id)
        .single();
      setLinkedPlanner({
        clientRecordId: data.id,
        plannerUserId: data.planner_user_id,
        plannerName: plannerProfile?.company_name || plannerProfile?.full_name || null,
      });
    } else {
      setLinkedPlanner(null);
    }
  };

  useEffect(() => {
    if (isPlanner && user) {
      loadClients();
    } else {
      setClients([]);
      setSelectedClient(null);
    }
  }, [isPlanner, user]);

  useEffect(() => {
    if (isCouple && user) {
      loadLinkedPlanner();
    } else {
      setLinkedPlanner(null);
    }
  }, [isCouple, user]);

  const selectClient = (client: PlannerClient | null) => setSelectedClient(client);

  const unlinkPlanner = async () => {
    if (!user || !linkedPlanner) return;
    // Clear linked_user_id on the planner_clients record
    await supabase
      .from('planner_clients')
      .update({ linked_user_id: null })
      .eq('id', linkedPlanner.clientRecordId);
    // Also update the link request status
    await supabase
      .from('planner_link_requests')
      .delete()
      .eq('couple_user_id', user.id)
      .eq('planner_user_id', linkedPlanner.plannerUserId);
    setLinkedPlanner(null);
  };

  // Build filters
  let dataFilterKey: 'user_id' | 'client_id' | null = null;
  let dataFilterValue: string | null = null;
  let dataOrFilter: string | null = null;

  if (user) {
    if (isPlanner && selectedClient) {
      dataFilterKey = 'client_id';
      dataFilterValue = selectedClient.id;
      // If linked, also show couple's own data
      if (selectedClient.linked_user_id) {
        dataOrFilter = `client_id.eq.${selectedClient.id},user_id.eq.${selectedClient.linked_user_id}`;
      } else {
        dataOrFilter = `client_id.eq.${selectedClient.id}`;
      }
    } else if (!isPlanner) {
      dataFilterKey = 'user_id';
      dataFilterValue = user.id;
      // If linked to a planner, also show planner-created data
      if (linkedPlanner) {
        dataOrFilter = `user_id.eq.${user.id},client_id.eq.${linkedPlanner.clientRecordId}`;
      } else {
        dataOrFilter = `user_id.eq.${user.id}`;
      }
    }
  }

  return (
    <PlannerContext.Provider value={{
      clients, selectedClient, selectClient, loadClients, isPlanner,
      dataFilterKey, dataFilterValue, dataOrFilter,
      linkedPlanner, loadLinkedPlanner, unlinkPlanner,
    }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within PlannerProvider');
  return context;
}
