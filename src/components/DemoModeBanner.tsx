import { useState } from 'react';
import { FlaskConical, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { demoRoleLabel } from '@/lib/demoSessions';

export default function DemoModeBanner() {
  const { session, reset, exit } = useDemoSession();
  const [working, setWorking] = useState<'reset' | 'exit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const run = async (action: 'reset' | 'exit') => {
    if (action === 'reset' && !window.confirm('Reset this demo and restore all sample data?')) return;
    setWorking(action);
    setError(null);
    try {
      if (action === 'reset') await reset();
      else await exit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The demo action could not be completed.');
      setWorking(null);
    }
  };

  return (
    <section className="mb-3 rounded-2xl border border-primary/25 bg-primary/[0.07] px-3 py-3 shadow-sm sm:mb-5 sm:px-4" aria-label="Demo mode">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-[12rem] flex-1">
          <p className="text-sm font-semibold">{demoRoleLabel(session.demoRole)} demo</p>
          <p className="text-xs leading-5 text-muted-foreground">Try the planning tools freely. This workspace is private and temporary; payments, AI requests, invitations and emails are disabled.</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={Boolean(working)} onClick={() => void run('reset')}>
          {working === 'reset' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
          Reset demo
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={Boolean(working)} onClick={() => void run('exit')}>
          {working === 'exit' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
          Exit
        </Button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs font-medium text-destructive">{error}</p> : null}
    </section>
  );
}
