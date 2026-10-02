import type { ReactNode } from 'react';
import { PlannerProvider } from '@/contexts/PlannerContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { DemoSessionProvider } from '@/contexts/DemoSessionContext';

export default function WorkspaceProviders({ children }: { children: ReactNode }) {
  return (
    <DemoSessionProvider>
      <PlannerProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </PlannerProvider>
    </DemoSessionProvider>
  );
}
