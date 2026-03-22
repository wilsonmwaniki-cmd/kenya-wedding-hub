import { Briefcase, Store, UserCog, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { SignupRole } from '@/lib/roles';

type UserRoleChooserProps = {
  value: SignupRole;
  onChange: (role: SignupRole) => void;
  helperClassName?: string;
  cardClassName?: string;
  selectedCardClassName?: string;
  unselectedCardClassName?: string;
  emphasizeSelected?: boolean;
};

type UserRoleChooserPanelProps = {
  value: SignupRole;
  onChange: (role: SignupRole) => void;
  eyebrow?: string;
  title?: string;
  description?: string;
  helperText?: ReactNode;
  className?: string;
  children?: ReactNode;
  emphasizeSelected?: boolean;
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
  emphasizeSelected = false,
}: UserRoleChooserProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {roleOptions.map((option) => (
        <motion.button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          initial={
            emphasizeSelected && value === option.value
              ? { scale: 0.96, y: 8, opacity: 0.92, boxShadow: '0 0 0 rgba(0,0,0,0)' }
              : false
          }
          animate={
            emphasizeSelected && value === option.value
              ? {
                  scale: 1,
                  y: 0,
                  opacity: 1,
                  boxShadow: '0 18px 40px rgba(224, 98, 47, 0.18)',
                }
              : {
                  scale: 1,
                  y: 0,
                  opacity: 1,
                  boxShadow: '0 0 0 rgba(0,0,0,0)',
                }
          }
          transition={{
            duration: emphasizeSelected && value === option.value ? 0.4 : 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`${cardClassName} ${value === option.value ? selectedCardClassName : unselectedCardClassName}`}
        >
          <option.icon className="h-4 w-4" />
          <span className="text-xs font-semibold leading-tight text-foreground">{option.title}</span>
          <span className="text-[10px] leading-relaxed text-muted-foreground">{option.description}</span>
          <span className={helperClassName}>{option.helper}</span>
        </motion.button>
      ))}
    </div>
  );
}

export function UserRoleChooserPanel({
  value,
  onChange,
  eyebrow = 'Start here',
  title = 'How will you use Zania?',
  description = 'Choose the option that best matches what you want to do first.',
  helperText = (
    <>
      Most people choose <span className="font-medium text-foreground">Couple</span> for their own wedding, and{' '}
      <span className="font-medium text-foreground">Wedding Committee</span> for a family-led wedding.
    </>
  ),
  className = '',
  children,
  emphasizeSelected = false,
}: UserRoleChooserPanelProps) {
  return (
    <div className={`rounded-[28px] border border-border/60 bg-card/95 p-5 shadow-warm backdrop-blur-sm ${className}`.trim()}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h3 className="font-display text-2xl font-semibold text-card-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{helperText}</p>
      </div>

      <div className="mt-4">
        <UserRoleChooser value={value} onChange={onChange} emphasizeSelected={emphasizeSelected} />
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
