import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Loader2, Users, Briefcase, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getHomeRouteForRole, type SignupRole } from '@/lib/roles';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>('couple');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user, profile, loading } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to={getHomeRouteForRole(profile?.role)} replace />;

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
        await signUp(email, password, fullName, role);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-md shadow-warm border-border/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center gap-2">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-bold text-foreground">WeddingPlan</span>
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
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setRole('couple')}
                          className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                            role === 'couple'
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <Users className="h-5 w-5" />
                          <span className="text-sm font-medium">Couple</span>
                          <span className="text-[10px] text-center leading-tight">Plan your wedding</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('planner')}
                          className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                            role === 'planner'
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <Briefcase className="h-5 w-5" />
                          <span className="text-sm font-medium">Planner</span>
                          <span className="text-[10px] text-center leading-tight">Manage clients</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('vendor')}
                          className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                            role === 'vendor'
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <Store className="h-5 w-5" />
                          <span className="text-sm font-medium">Vendor</span>
                          <span className="text-[10px] text-center leading-tight">List your business</span>
                        </button>
                      </div>
                    </div>
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
                <Button type="submit" className="w-full" disabled={submitting}>
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
