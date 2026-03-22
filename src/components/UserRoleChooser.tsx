import { Briefcase, Store, UserCog, Users } from 'lucide-react';
import type { SignupRole } from '@/lib/roles';

type UserRoleChooserProps = {
  value: SignupRole;
  onChange: (role: SignupRole) => void;
  helperClassName?: string;
  cardClassName?: string;
  selectedCardClassName?: string;
  unselectedCardClassName?: string;
};

const roleOptions = [
  {
    value: 'couple' as const,
    icon: Users,
    title: "I'm planning my own wedding",
    description: 'For a bride, groom, or partner managing budget, vendors, guests, and tasks.',
    helper: 'Choose: Couple',
  },
  {
    value: 'committee' as const,
    icon: UserCog,
    title: "I'm part of a wedding committee",
    description: 'For a chair, sibling, cousin, or family organizer helping run one wedding together.',
    helper: 'Choose: Wedding Committee',
  },
  {
    value: 'planner' as const,
    icon: Briefcase,
    title: "I'm a professional planner",
    description: 'For planners and coordinators managing weddings for clients.',
    helper: 'Choose: Planner',
  },
  {
    value: 'vendor' as const,
    icon: Store,
    title: "I'm a vendor",
    description: 'For photographers, caterers, florists, DJs, venues, decor teams, and other service providers.',
    helper: 'Choose: Vendor',
  },
];

export function UserRoleChooser({
  value,
  onChange,
  helperClassName = 'text-[11px] font-medium uppercase tracking-[0.12em] text-primary',
  cardClassName = 'flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-colors',
  selectedCardClassName = 'border-primary bg-primary/5 text-primary',
  unselectedCardClassName = 'border-border bg-background text-muted-foreground hover:border-primary/50',
}: UserRoleChooserProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {roleOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`${cardClassName} ${value === option.value ? selectedCardClassName : unselectedCardClassName}`}
        >
          <option.icon className="h-4 w-4" />
          <span className="text-xs font-semibold leading-tight text-foreground">{option.title}</span>
          <span className="text-[10px] leading-relaxed text-muted-foreground">{option.description}</span>
          <span className={helperClassName}>{option.helper}</span>
        </button>
      ))}
    </div>
  );
}

