import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getHomeRouteForRole, type SignupRole } from '@/lib/roles';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { hasPendingEstimatorPlanDraft, seedPendingEstimatorPlanForUser } from '@/lib/estimatorPlanSeed';
import { UserRoleChooser } from '@/components/UserRoleChooser';

export default function Auth() {
  const location = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>('couple');
  const [committeeName, setCommitteeName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const { signIn, signUp, signInWithGoogle, user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const state = location.state as { mode?: 'signup' | 'signin'; role?: SignupRole } | null;
    if (!state) return;

    if (state.mode) {
      setIsSignUp(state.mode === 'signup');
      setIsForgot(false);
    }

    if (state.role) {
      setRole(state.role);
    }
  }, [location.state]);

  useEffect(() => {
    if (loading || !user || !profile?.role || redirecting) return;

    let active = true;

    const finalizeEntry = async () => {
      setRedirecting(true);

      try {
        if (hasPendingEstimatorPlanDraft()) {
          const seeded = await seedPendingEstimatorPlanForUser({
            userId: user.id,
            role: profile.role,
            plannerType: profile.planner_type,
          });

          if (seeded && active) {
            toast({
              title: 'Wedding plan ready',
              description: 'Your estimate was turned into a starter budget, vendor list, and tasks.',
            });
            navigate('/budget', { replace: true });
            return;
          }
        }

        if (active) {
          navigate(getHomeRouteForRole(profile.role, profile.planner_type), { replace: true });
        }
      } catch (err: any) {
        if (active) {
          toast({
            title: 'Could not build your plan',
            description: err.message,
            variant: 'destructive',
          });
          navigate(getHomeRouteForRole(profile.role, profile.planner_type), { replace: true });
        }
      }
    };

    void finalizeEntry();

    return () => {
      active = false;
    };
  }, [loading, navigate, profile?.planner_type, profile?.role, redirecting, toast, user]);

  if (loading || redirecting || (user && !profile?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Reset link sent!', description: 'Check your email for the password reset link.' });
      setIsForgot(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName, role, {
          committeeName: role === 'committee' ? committeeName : null,
        });
        toast({ title: 'Account created!', description: 'Check your email to confirm your account.' });
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-md shadow-warm border-border/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center gap-2">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-bold text-foreground">Zania</span>
          </div>
          <CardTitle className="font-display text-xl">{isForgot ? 'Forgot Password' : isSignUp ? 'Create Account' : 'Welcome Back'}</CardTitle>
          <CardDescription>
            {isForgot ? 'Enter your email to receive a reset link' : isSignUp ? 'Start planning your perfect Kenyan wedding' : 'Sign in to continue planning'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Reset Link
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setIsForgot(false)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="space-y-4">
                <GoogleAuthButton
                  loading={googleSubmitting}
                  disabled={submitting || googleSubmitting}
                  onClick={handleGoogleSignIn}
                />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or use email</span>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">{role === 'committee' ? 'Committee Chair Name' : 'Full Name'}</Label>
                      <Input
                        id="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={role === 'committee' ? 'The main person coordinating the committee' : 'Your full name'}
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>How will you use Zania?</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose the option that best matches what you want to do first.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Most people pick <span className="font-medium text-foreground">Couple</span> when planning their own wedding, and <span className="font-medium text-foreground">Wedding Committee</span> for a family-led wedding.
                        </p>
                      </div>
                      <UserRoleChooser
                        value={role}
                        onChange={setRole}
                      />
                    </div>
                    {role === 'committee' && (
                      <div className="space-y-2">
                        <Label htmlFor="committee-name">Committee Name</Label>
                        <Input
                          id="committee-name"
                          value={committeeName}
                          onChange={(e) => setCommitteeName(e.target.value)}
                          placeholder="e.g. Mary & James Wedding Committee"
                          required
                        />
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                      <button type="button" onClick={() => setIsForgot(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || googleSubmitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
