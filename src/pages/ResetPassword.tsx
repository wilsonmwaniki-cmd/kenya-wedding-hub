import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BrandWordmark from '@/components/BrandWordmark';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { PublicPageSkeleton } from '@/components/AppLoadingSkeletons';

const PASSWORD_RECOVERY_SESSION_KEY = 'zania:password-recovery-active';

function setRecoverySessionFlag(active: boolean) {
  if (typeof window === 'undefined') return;
  if (active) {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_SESSION_KEY, 'true');
  } else {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
  }
}

function hasRecoverySessionFlag() {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(PASSWORD_RECOVERY_SESSION_KEY) === 'true';
}

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [formErrors, setFormErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const initializeRecovery = async () => {
      const url = new URL(window.location.href);
      const searchParams = url.searchParams;
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const code = searchParams.get('code');
      const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');
      const typeInQuery = searchParams.get('type');
      const typeInHash = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const errorInQuery = searchParams.get('error') || searchParams.get('error_description');
      const errorInHash = hashParams.get('error') || hashParams.get('error_description');
      const hasRecoverySignal =
        typeInQuery === 'recovery'
        || typeInHash === 'recovery'
        || Boolean(code)
        || Boolean(tokenHash)
        || (Boolean(accessToken) && Boolean(refreshToken));

      // If backend already told us this link is invalid/expired, don't spin forever.
      if (errorInQuery || errorInHash) {
        setRecoverySessionFlag(false);
        if (!cancelled) setStatus('invalid');
        return;
      }

      // Fallback 1: If recovery tokens are present in hash, set session explicitly.
      if (accessToken && refreshToken && (typeInQuery === 'recovery' || typeInHash === 'recovery')) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          setRecoverySessionFlag(true);
          if (!cancelled) setStatus('ready');
          return;
        }
      }

      // Fallback 2: PKCE/code flow.
      if (code && (typeInQuery === 'recovery' || typeInHash === 'recovery')) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setRecoverySessionFlag(false);
          if (!cancelled) setStatus('invalid');
          return;
        }
        setRecoverySessionFlag(true);
      }

      // Fallback 3: token_hash-based recovery flow.
      if (tokenHash && (typeInQuery === 'recovery' || typeInHash === 'recovery')) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (error) {
          setRecoverySessionFlag(false);
          if (!cancelled) setStatus('invalid');
          return;
        }
        setRecoverySessionFlag(true);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session && (hasRecoverySignal || hasRecoverySessionFlag())) {
        setRecoverySessionFlag(true);
        if (!cancelled) setStatus('ready');
        return;
      }

      // Implicit flow indicator in hash/query; wait for auth event briefly.
      if (typeInHash === 'recovery' || typeInQuery === 'recovery') {
        return;
      }

      // No recovery signal + no session => invalid or stale entry to this page.
      setRecoverySessionFlag(false);
      if (!cancelled) setStatus('invalid');
    };

    initializeRecovery();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoverySessionFlag(true);
        setStatus('ready');
        return;
      }

      if (event === 'SIGNED_IN' && session && hasRecoverySessionFlag()) {
        setStatus('ready');
      }
    });

    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && hasRecoverySessionFlag()) {
        setStatus('ready');
      } else {
        setRecoverySessionFlag(false);
        setStatus('invalid');
      }
    }, 5000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { password?: string; confirmPassword?: string } = {};
    if (!password.trim()) {
      nextErrors.password = 'Enter a new password.';
    } else if (password.length < 6) {
      nextErrors.password = 'Minimum 6 characters.';
    }
    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Confirm your new password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    setFormErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setRecoverySessionFlag(false);
      await supabase.auth.signOut({ scope: 'local' });
      toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
      navigate('/sign-in');
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : 'Could not update your password right now.';
      setSubmitError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <PublicPageSkeleton />;
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
        <Card className="w-full max-w-md shadow-warm border-border/50">
          <CardHeader className="text-center space-y-3">
            <BrandWordmark size="md" />
            <CardTitle className="font-display text-xl">Reset Link Invalid</CardTitle>
            <CardDescription>
              This reset link is invalid or expired. Please request a new password reset email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => navigate('/forgot-password')}>
              Request New Reset Link
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/sign-in')}>
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-md shadow-warm border-border/50">
        <CardHeader className="text-center space-y-3">
          <BrandWordmark size="md" />
          <CardTitle className="font-display text-xl">Set New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormSubmitError message={submitError} />
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" value={password} onChange={e => { setPassword(e.target.value); setFormErrors((current) => ({ ...current, password: undefined })); setSubmitError(null); }} placeholder="••••••••" required minLength={6} aria-invalid={!!formErrors.password} />
              <FormFieldError message={formErrors.password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setFormErrors((current) => ({ ...current, confirmPassword: undefined })); setSubmitError(null); }} placeholder="••••••••" required minLength={6} aria-invalid={!!formErrors.confirmPassword} />
              <FormFieldError message={formErrors.confirmPassword} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
