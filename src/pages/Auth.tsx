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
import GoogleAuthButton from '@/components/GoogleAuthButton';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>('couple');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { signIn, signUp, signInWithGoogle, user, profile, loading } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && profile?.role) return <Navigate to={getHomeRouteForRole(profile.role)} replace />;

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
                <Button type="submit" className="w-full" disabled={submitting || googleSubmitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={googleLoading || submitting}
                onClick={async () => {
                  setGoogleLoading(true);
                  const { error } = await lovable.auth.signInWithOAuth('google', {
                    redirect_uri: window.location.origin,
                  });
                  if (error) {
                    toast({ title: 'Error', description: error.message, variant: 'destructive' });
                    setGoogleLoading(false);
                  }
                }}
              >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </Button>
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
