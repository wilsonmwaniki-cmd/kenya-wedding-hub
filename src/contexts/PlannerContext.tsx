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
}

interface PlannerContextType {
  clients: PlannerClient[];
  selectedClient: PlannerClient | null;
  selectClient: (client: PlannerClient | null) => void;
  loadClients: () => Promise<void>;
  isPlanner: boolean;
  /** Returns the filter params for queries — either user_id for couples or client_id for planners */
  getDataFilter: () => { key: string; value: string } | null;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [clients, setClients] = useState<PlannerClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<PlannerClient | null>(null);

  const isPlanner = profile?.role === 'planner';

  const loadClients = async () => {
    if (!user || !isPlanner) return;
    const { data } = await supabase
      .from('planner_clients')
      .select('*')
      .eq('planner_user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setClients(data as PlannerClient[]);
  };

  useEffect(() => {
    if (isPlanner && user) {
      loadClients();
    } else {
      setClients([]);
      setSelectedClient(null);
    }
  }, [isPlanner, user]);

  const selectClient = (client: PlannerClient | null) => {
    setSelectedClient(client);
  };

  const getDataFilter = () => {
    if (!user) return null;
    if (isPlanner && selectedClient) {
      return { key: 'client_id', value: selectedClient.id };
    }
    if (!isPlanner) {
      return { key: 'user_id', value: user.id };
    }
    return null;
  };

  return (
    <PlannerContext.Provider value={{ clients, selectedClient, selectClient, loadClients, isPlanner, getDataFilter }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within PlannerProvider');
  return context;
}
