import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const initializeRecovery = async () => {
      const url = new URL(window.location.href);
      const searchParams = url.searchParams;
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const code = searchParams.get('code');
      const typeInQuery = searchParams.get('type');
      const typeInHash = hashParams.get('type');
      const errorInQuery = searchParams.get('error') || searchParams.get('error_description');
      const errorInHash = hashParams.get('error') || hashParams.get('error_description');

      // If backend already told us this link is invalid/expired, don't spin forever.
      if (errorInQuery || errorInHash) {
        if (!cancelled) setStatus('invalid');
        return;
      }

      // PKCE/code flow: exchange code for a session first.
      if (code && (typeInQuery === 'recovery' || typeInHash === 'recovery')) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setStatus('invalid');
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (!cancelled) setStatus('ready');
        return;
      }

      // Implicit flow indicator in hash/query; wait for auth event briefly.
      if (typeInHash === 'recovery' || typeInQuery === 'recovery') {
        return;
      }

      // No recovery signal + no session => invalid or stale entry to this page.
      if (!cancelled) setStatus('invalid');
    };

    initializeRecovery();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready');
      }
    });

    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus('ready');
      } else {
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
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Minimum 6 characters.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
      navigate('/auth');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
        <Card className="w-full max-w-md shadow-warm border-border/50">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex items-center gap-2">
              <Heart className="h-7 w-7 text-primary" fill="currentColor" />
              <span className="font-display text-2xl font-bold text-foreground">WeddingPlan</span>
            </div>
            <CardTitle className="font-display text-xl">Reset Password</CardTitle>
            <CardDescription>Loading your recovery session...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
        <Card className="w-full max-w-md shadow-warm border-border/50">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex items-center gap-2">
              <Heart className="h-7 w-7 text-primary" fill="currentColor" />
              <span className="font-display text-2xl font-bold text-foreground">WeddingPlan</span>
            </div>
            <CardTitle className="font-display text-xl">Reset Link Invalid</CardTitle>
            <CardDescription>
              This reset link is invalid or expired. Please request a new password reset email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => navigate('/')}>
              Request New Reset Link
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
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
          <div className="mx-auto flex items-center gap-2">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-bold text-foreground">WeddingPlan</span>
          </div>
          <CardTitle className="font-display text-xl">Set New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
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
