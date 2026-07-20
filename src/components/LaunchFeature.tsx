import { isLaunchFeatureEnabled } from '@/lib/featureFlags';

interface LaunchFeatureProps {
  path: string;
  children: React.ReactNode;
}

export default function LaunchFeature({ path, children }: LaunchFeatureProps) {
  if (isLaunchFeatureEnabled(path)) return <>{children}</>;

  return (
    <div className="flex min-h-[65vh] items-center justify-center px-6 py-16">
      <div className="max-w-md rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Coming soon</p>
        <h1 className="workspace-h2 mt-3">We’re perfecting this part of Zania</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This feature is being tested on staging and will be released as soon as it is ready.
        </p>
      </div>
    </div>
  );
}
