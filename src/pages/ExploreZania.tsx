import { useCallback, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Heart,
  Loader2,
  ShieldCheck,
  Store,
} from 'lucide-react';
import BrandWordmark from '@/components/BrandWordmark';
import PublicSiteFooter from '@/components/PublicSiteFooter';
import TurnstileChallenge from '@/components/TurnstileChallenge';
import { Button } from '@/components/ui/button';
import {
  TonalCard,
  TonalCardBody,
  TonalCardFooter,
  TonalCardHeader,
  TonalCardTitle,
} from '@/components/ui/tonal-card';
import { useAuth } from '@/contexts/AuthContext';
import { isAnonymousDemoUser, startDemoSession, type DemoRole } from '@/lib/demoSessions';
import { getHomeRouteForRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

type RoleOption = {
  role: DemoRole;
  label: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  highlights: string[];
  destination: string;
};

const readErrorMessage = (cause: unknown) => {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
    return cause.message;
  }
  return 'The demo could not be started. Please try again.';
};

const roleOptions: RoleOption[] = [
  {
    role: 'couple',
    label: 'Couple',
    title: 'Continue a wedding already in progress.',
    description: 'See how the moving parts come together without entering any of your own details.',
    icon: Heart,
    highlights: ['A calm wedding homepage', 'Budget, tasks and vendors', 'Quotes, invoices and contracts'],
    destination: 'Opens the couple workspace',
  },
  {
    role: 'vendor',
    label: 'Professional',
    title: 'Run a sample wedding business.',
    description: 'Work with realistic clients and documents inside the same professional tools you would use every day.',
    icon: Store,
    highlights: ['Professional dashboard', 'Client and booking pipeline', 'Editable document workspace'],
    destination: 'Opens the professional dashboard',
  },
  {
    role: 'planner',
    label: 'Planner',
    title: 'Coordinate several sample weddings.',
    description: 'Move between clients, then open a complete wedding workspace to see planning in context.',
    icon: BriefcaseBusiness,
    highlights: ['Three sample weddings', 'Per-client budgets and tasks', 'Planner documents and activity'],
    destination: 'Opens the planner portfolio',
  },
];

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';

export default function ExploreZania() {
  const { user, profile, loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<DemoRole>('couple');
  const [startingRole, setStartingRole] = useState<DemoRole | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [challengeKey, setChallengeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const signedIntoRealAccount = Boolean(user && !isAnonymousDemoUser(user));
  const requiresCaptcha = Boolean(turnstileSiteKey && !user);
  const selected = roleOptions.find((option) => option.role === selectedRole) ?? roleOptions[0];

  const handleCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), []);
  const handleCaptchaError = useCallback((message: string | null) => setCaptchaError(message), []);

  const start = async (role: DemoRole) => {
    if (requiresCaptcha && !captchaToken) {
      setError('Complete the security check before starting the demo.');
      return;
    }

    setStartingRole(role);
    setError(null);
    try {
      const demo = captchaToken
        ? await startDemoSession(role, captchaToken)
        : await startDemoSession(role);
      window.location.assign(demo.destinationPath);
    } catch (cause) {
      setError(readErrorMessage(cause));
      setStartingRole(null);
      if (requiresCaptcha) {
        setCaptchaToken(null);
        setChallengeKey((value) => value + 1);
      }
    }
  };

  const workspacePath = profile ? getHomeRouteForRole(profile.role, profile.planner_type) : '/dashboard';

  return (
    <div className="min-h-screen bg-[#fffdfa] text-[#251e1a]">
      <header className="border-b border-[#e4d8ca] bg-[#fffdfa]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Zania home" className="shrink-0">
            <BrandWordmark size="sm" className="whitespace-nowrap" />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3" aria-label="Explore page navigation">
            <Button asChild variant="ghost" size="sm">
              <Link to="/" aria-label="Home"><ArrowLeft className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Home</span></Link>
            </Button>
            {!user ? <Button asChild size="sm"><Link to="/sign-in">Sign in</Link></Button> : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(34rem,1.28fr)] lg:items-start lg:gap-16">
          <section className="max-w-xl lg:sticky lg:top-10" aria-labelledby="explore-heading">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a85838]">Explore Zania</p>
            <h1 id="explore-heading" className="mt-4 font-display text-4xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.65rem]">
              Choose the workspace you want to try.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#766b63]">
              Enter the real Zania interface with a private, ready-made workspace. Change the sample data freely—no setup and no commitment.
            </p>

            <div className="mt-8 border-y border-[#e4d8ca] py-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2f9d68]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Safe to explore</p>
                  <p className="mt-1 text-sm leading-6 text-[#766b63]">
                    Your demo is private and expires automatically. Payments, messages and invitations are disabled.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-[#766b63]">
              Ready to use Zania for real?{' '}
              <Link to="/auth?mode=signup" className="font-semibold text-[#251e1a] underline decoration-[#c2724f] underline-offset-4 hover:text-[#a85838]">
                Create an account
              </Link>
            </p>
          </section>

          {signedIntoRealAccount ? (
            <TonalCard tone="porcelain">
              <TonalCardHeader>
                <ShieldCheck className="h-6 w-6 text-[#2f9d68]" aria-hidden="true" />
                <TonalCardTitle className="pt-2">You are already signed in</TonalCardTitle>
                <p className="max-w-xl text-sm leading-6 text-current/65">
                  Demo workspaces use a separate temporary identity so your real data stays untouched. Sign out first to try a demo, or return to your workspace.
                </p>
              </TonalCardHeader>
              <TonalCardFooter>
                <Button asChild><Link to={workspacePath}>Return to my workspace<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </TonalCardFooter>
            </TonalCard>
          ) : (
            <TonalCard tone="porcelain" aria-label="Choose a demo role">
              <div className="grid grid-cols-3 border-b border-current/10" role="tablist" aria-label="Choose the demo workspace">
                {roleOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = option.role === selectedRole;
                  return (
                    <button
                      key={option.role}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls="demo-role-details"
                      onClick={() => {
                        setSelectedRole(option.role);
                        setError(null);
                      }}
                      className={cn(
                        'flex min-h-16 items-center justify-center gap-2 border-r border-current/10 px-2 py-3 text-xs font-semibold transition-colors duration-200 last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c2724f] sm:text-sm',
                        isSelected ? 'bg-[#c2724f] text-white' : 'bg-white/25 text-current/65 hover:bg-white/65 hover:text-current',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div id="demo-role-details" role="tabpanel" className="min-h-[22rem]">
                <TonalCardHeader className="pb-5 sm:pb-5">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#a85838]">{selected.label} workspace</p>
                  <TonalCardTitle className="max-w-xl text-2xl sm:text-[1.85rem]">{selected.title}</TonalCardTitle>
                  <p className="max-w-xl text-sm leading-6 text-current/65">{selected.description}</p>
                </TonalCardHeader>

                <TonalCardBody>
                  <div className="border-t border-current/10 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-current/50">Inside this demo</p>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                      {selected.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-2 text-sm leading-5">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2f9d68]" aria-hidden="true" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {requiresCaptcha ? (
                    <div className="mt-6 border-t border-current/10 pt-5">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.9fr)] sm:items-center">
                        <div>
                          <p className={cn('flex items-center gap-2 text-sm font-semibold', captchaToken ? 'text-[#237a50]' : undefined)}>
                            {captchaToken ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                            {captchaToken ? 'Security check completed automatically' : 'Quick security check'}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-current/60">
                            {captchaToken
                              ? 'No action was needed. You can start the demo.'
                              : 'This protects Zania from automated demo signups.'}
                          </p>
                        </div>
                        {!captchaToken ? (
                          <TurnstileChallenge
                            key={challengeKey}
                            siteKey={turnstileSiteKey}
                            onVerify={handleCaptchaToken}
                            onError={handleCaptchaError}
                          />
                        ) : null}
                      </div>
                      {captchaError ? <p role="alert" className="mt-3 text-sm font-medium text-[#b4232c]">{captchaError}</p> : null}
                    </div>
                  ) : null}

                  {error ? (
                    <div role="alert" className="mt-5 border-l-2 border-[#d9363e] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b4232c]">
                      {error}
                    </div>
                  ) : null}
                </TonalCardBody>
              </div>

              <TonalCardFooter className="justify-between sm:items-center">
                <div>
                  <p className="text-sm font-semibold">{selected.destination}</p>
                  <p className="mt-0.5 text-xs text-current/60">No account or payment details needed</p>
                </div>
                <Button
                  className="min-w-44"
                  disabled={Boolean(startingRole) || loading || (requiresCaptcha && !captchaToken)}
                  onClick={() => void start(selected.role)}
                >
                  {startingRole === selected.role ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {startingRole === selected.role ? 'Preparing workspace…' : `Try as ${selected.label.toLowerCase()}`}
                  {startingRole !== selected.role ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </Button>
              </TonalCardFooter>
            </TonalCard>
          )}
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
