import { Link } from 'react-router-dom';
import BrandWordmark from '@/components/BrandWordmark';
import { cn } from '@/lib/utils';

type PublicSiteFooterProps = {
  dark?: boolean;
  className?: string;
};

export default function PublicSiteFooter({ dark = false, className }: PublicSiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'border-t px-6 py-8 sm:px-8 lg:px-12',
        dark
          ? 'border-[#f3e4ce]/10 bg-[#1c1612] text-[#f6eee6]'
          : 'border-border/70 bg-transparent text-foreground',
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <BrandWordmark light={dark} size="md" />
          <p className={cn('max-w-md text-sm leading-6', dark ? 'text-[#f6eee6]/72' : 'text-muted-foreground')}>
            Zania is owned by Scarlet Plume.
          </p>
        </div>

        <div
          className={cn(
            'flex flex-col gap-3 text-sm sm:items-end sm:text-right',
            dark ? 'text-[#f6eee6]/72' : 'text-muted-foreground',
          )}
        >
          <div
            className={cn(
              'flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.18em]',
              dark ? 'text-[#f6eee6]/82' : 'text-foreground/72',
            )}
          >
            <Link to="/" className="transition-opacity hover:opacity-100">
              Home
            </Link>
            <Link to="/pricing" className="transition-opacity hover:opacity-100">
              Pricing
            </Link>
            <Link to="/sign-in" className="transition-opacity hover:opacity-100">
              Sign in
            </Link>
          </div>
          <p>© {year} Zania. Wedding planning for Kenya and the diaspora.</p>
        </div>
      </div>
    </footer>
  );
}
