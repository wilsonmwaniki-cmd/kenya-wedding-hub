import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';

import BrandWordmark from '@/components/BrandWordmark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { clearOAuthConsentReturn, rememberOAuthConsentReturn } from '@/lib/oauthConsent';

const scopeDescriptions: Record<string, string> = {
  openid: 'Confirm your Zania account identity',
  email: 'Show the email address attached to your Zania account',
  profile: 'Show your Zania profile name',
};

function describeScope(scope: string) {
  return scopeDescriptions[scope] || `Use the ${scope} permission requested by this app`;
}

export default function OAuthConsent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const authorizationId = useMemo(
    () => new URLSearchParams(location.search).get('authorization_id')?.trim() || '',
    [location.search],
  );
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'approve' | 'deny' | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!authorizationId || authorizationId.length > 512) {
      setError('This connection request is missing or invalid. Return to the app that sent you here and try again.');
      return;
    }
    if (!user) {
      const returnPath = `${location.pathname}${location.search}`;
      rememberOAuthConsentReturn(returnPath);
      navigate('/sign-in', { replace: true, state: { from: returnPath } });
      return;
    }

    clearOAuthConsentReturn();
    let active = true;
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: requestError }) => {
      if (!active) return;
      if (requestError || !data) {
        setError(requestError?.message || 'Zania could not load this connection request.');
        return;
      }
      if ('redirect_url' in data) {
        window.location.assign(data.redirect_url);
        return;
      }
      setDetails(data);
    });
    return () => { active = false; };
  }, [authLoading, authorizationId, location.pathname, location.search, navigate, user]);

  const decide = async (nextDecision: 'approve' | 'deny') => {
    if (!authorizationId || decision) return;
    setDecision(nextDecision);
    setError(null);
    const action = nextDecision === 'approve'
      ? supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    const { data, error: decisionError } = await action;
    if (decisionError || !data?.redirect_url) {
      setError(decisionError?.message || 'Zania could not complete your choice. Please try again.');
      setDecision(null);
      return;
    }
    window.location.assign(data.redirect_url);
  };

  const scopes = details?.scope?.split(/\s+/).filter(Boolean) ?? [];
  const clientName = details?.client?.name || 'An external app';

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex justify-center"><BrandWordmark /></div>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="font-display text-2xl">Connect to Zania?</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6">
                Review what this app can access before you continue.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!details && !error ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading connection details…
              </div>
            ) : null}

            {details ? (
              <>
                <section className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Requesting app</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{clientName}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{details.redirect_uri}</p>
                </section>

                <section aria-labelledby="permissions-title">
                  <h2 id="permissions-title" className="text-sm font-semibold text-foreground">This connection can</h2>
                  <ul className="mt-3 space-y-3">
                    <li className="flex gap-3 text-sm leading-6 text-muted-foreground">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      Read only the wedding records your signed-in Zania account is already allowed to see.
                    </li>
                    <li className="flex gap-3 text-sm leading-6 text-muted-foreground">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      Use Zania's premium conversational planning tools on your behalf.
                    </li>
                    {scopes.map((scope) => (
                      <li key={scope} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        {describeScope(scope)}
                      </li>
                    ))}
                  </ul>
                </section>

                <p className="text-xs leading-5 text-muted-foreground">
                  Zania will continue to enforce your account role, wedding membership and paid-plan access. You can revoke the connection later.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" disabled={decision !== null} onClick={() => void decide('deny')}>
                    {decision === 'deny' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                    Deny
                  </Button>
                  <Button disabled={decision !== null} onClick={() => void decide('approve')}>
                    {decision === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    Allow connection
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
