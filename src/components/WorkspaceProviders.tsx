import type { ReactNode } from 'react';
import { PlannerProvider } from '@/contexts/PlannerContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function WorkspaceProviders({ children }: { children: ReactNode }) {
  return (
    <PlannerProvider>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </PlannerProvider>
  );
}
