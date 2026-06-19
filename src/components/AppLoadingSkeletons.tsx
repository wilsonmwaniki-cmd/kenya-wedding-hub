import { Skeleton } from '@/components/ui/skeleton';

export function WorkspacePageSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-card">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-9 w-24" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-card">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: compact ? 3 : 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border/50 bg-background/75 p-4">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="mt-4 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
                <Skeleton className="mt-6 h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-card">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-3 h-4 w-48" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border/50 bg-background/75 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-5 w-40" />
                <Skeleton className="mt-4 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DirectoryResultsSkeleton({
  cards = 6,
}: {
  cards?: number;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-card">
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-6 w-40 max-w-full" />
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-11/12" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-6 h-11 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export function ListRowsSkeleton({
  rows = 4,
}: {
  rows?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function PublicPageSkeleton({
  card = true,
}: {
  card?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(212,118,70,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(212,187,125,0.12),transparent_26%),linear-gradient(180deg,#fbf7f1_0%,#f7f1e8_42%,#f5ede2_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <div className={card ? 'w-full max-w-2xl rounded-[2rem] border border-border/70 bg-background/95 p-8 shadow-[0_28px_90px_rgba(46,26,20,0.12)] backdrop-blur' : 'w-full max-w-3xl'}>
          <div className="space-y-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-12 w-72 max-w-full" />
            <Skeleton className="h-4 w-[28rem] max-w-full" />
            <Skeleton className="h-4 w-[22rem] max-w-full" />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="mt-6 space-y-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssistantWorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-card">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="mt-4 h-7 w-40" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-[28rem] max-w-full" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-16 w-36 rounded-2xl" />
            <Skeleton className="h-16 w-36 rounded-2xl" />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card shadow-card">
        <div className="space-y-4 border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-44" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-52 rounded-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex justify-start">
            <Skeleton className="h-20 w-[70%] rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-16 w-[52%] rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-24 w-[78%] rounded-2xl" />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
