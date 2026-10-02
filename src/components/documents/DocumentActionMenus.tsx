import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type DocumentMenuAction = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
  destructive?: boolean;
  separated?: boolean;
};

function ActionMenu({ label, actions }: { label: string; actions: DocumentMenuAction[] }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto">
          {label}
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60 p-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.label}>
              {action.separated && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={action.disabled}
                onSelect={() => void action.onSelect()}
                className={`min-h-11 gap-3 px-3 ${action.destructive ? 'text-destructive focus:text-destructive' : ''}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {action.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DocumentActionMenus({
  actions,
  shareActions,
  primary,
  className,
}: {
  actions: DocumentMenuAction[];
  shareActions?: DocumentMenuAction[];
  primary?: { label: string; icon: LucideIcon; onClick: () => void | Promise<void>; disabled?: boolean };
  className?: string;
}) {
  const PrimaryIcon = primary?.icon;
  return (
    <div className={cn("grid min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap", className)}>
      <ActionMenu label="Actions" actions={actions} />
      {shareActions?.length ? <ActionMenu label="Share" actions={shareActions} /> : null}
      {primary && PrimaryIcon ? (
        <Button type="button" className="col-span-2 w-full gap-2 sm:w-auto" onClick={() => void primary.onClick()} disabled={primary.disabled}>
          <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
          {primary.label}
        </Button>
      ) : null}
    </div>
  );
}
