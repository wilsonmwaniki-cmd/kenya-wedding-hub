import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Gift, Loader2, Trash2 } from 'lucide-react';
import { WorkspacePageSkeleton, ListRowsSkeleton } from '@/components/AppLoadingSkeletons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { getEntitlementDecision } from '@/lib/entitlements';
import { getCoupleAddonDefinition } from '@/lib/pricingPlans';
import { getCheckoutReferenceFromSearchParams, startCheckout, syncCoupleCheckout, withCheckoutSessionId } from '@/lib/billing';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { normalizeExternalUrl } from '@/lib/security';
import { useDeferredDelete } from '@/hooks/useDeferredDelete';
import { useAssistantPageContext } from '@/contexts/AssistantPanelContext';
import { buildConciergeContext } from '@/lib/conciergeContext';

type RegistryItem = {
  id: string;
  wedding_id: string;
  title: string;
  description: string | null;
  category: string | null;
  estimated_price_kes: number | null;
  purchase_url: string | null;
  is_purchased: boolean;
  purchased_at: string | null;
  created_at: string;
};

type RegistryFormState = {
  title: string;
  description: string;
  category: string;
  estimatedPriceKes: string;
  purchaseUrl: string;
};

const registryHighlights = [
  'Add the gifts you actually want in one list.',
  'Mark items as bought so they are clearly struck off.',
  'Keep useful links and pricing notes next to each gift.',
] as const;

const emptyForm: RegistryFormState = {
  title: '',
  description: '',
  category: '',
  estimatedPriceKes: '',
  purchaseUrl: '',
};

function normalizePurchaseUrl(value: string) {
  return normalizeExternalUrl(value);
}

function sortRegistryItems(items: RegistryItem[]) {
  return [...items].sort((a, b) => {
    if (a.is_purchased !== b.is_purchased) return a.is_purchased ? 1 : -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function normalizeRegistryItem(row: any): RegistryItem {
  return {
    ...row,
    estimated_price_kes:
      row?.estimated_price_kes == null ? null : Number(row.estimated_price_kes),
  } as RegistryItem;
}

function formatKes(value: number | null) {
  if (value == null) return null;
  return `KES ${value.toLocaleString()}`;
}

export default function GiftRegistry() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pendingIds: pendingDeleteIds, scheduleDelete } = useDeferredDelete();
  const { profile, isSuperAdmin, rolePreview } = useAuth();
  const { weddingId, entitlements, couplePlanTier, loading, refresh } = useWeddingEntitlements();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [processedCheckoutSessionId, setProcessedCheckoutSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [form, setForm] = useState<RegistryFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RegistryFormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const decision = getEntitlementDecision('couple.gift_registry', {
    profile,
    bypass: isSuperAdmin && rolePreview === 'couple',
    weddingEntitlements: entitlements,
    couplePlanTier,
  });

  const canAccessRegistry = decision.allowed && Boolean(weddingId);
  const addon = getCoupleAddonDefinition('gift_registry_addon');
  const isFocusedUpgradeFlow = searchParams.get('intent') === 'upgrade';
  const upgradeState = searchParams.get('upgrade');
  const checkoutReference = getCheckoutReferenceFromSearchParams(searchParams);

  const statusMessage = useMemo(() => {
    if (upgradeState === 'success') {
      return {
        title: 'Gift Registry unlocked',
        body: 'Your registry is now active. Start adding gifts and mark them off as they get claimed.',
        tone: 'success',
      } as const;
    }

    if (upgradeState === 'cancelled') {
      return {
        title: 'Checkout cancelled',
        body: 'No problem. Your registry add-on was not purchased yet, and you can come back to it anytime.',
        tone: 'warning',
      } as const;
    }

    return null;
  }, [upgradeState]);

  useEffect(() => {
    if (
      upgradeState !== 'success'
      || !checkoutReference
      || processedCheckoutSessionId === checkoutReference
      || !profile
    ) {
      return;
    }

    let cancelled = false;
    setProcessedCheckoutSessionId(checkoutReference);

    const runSync = async () => {
      try {
        await syncCoupleCheckout(checkoutReference);
        if (cancelled) return;

        await refresh();
        if (cancelled) return;

        toast({
          title: 'Gift Registry unlocked',
          description: 'Your registry add-on is now active for this wedding workspace.',
        });
        navigate('/gift-registry?upgrade=success', { replace: true });
      } catch (error: any) {
        if (cancelled) return;
        toast({
          title: 'Payment completed but activation is still pending',
          description: error?.message || 'The checkout succeeded, but we could not sync your Gift Registry access yet.',
          variant: 'destructive',
        });
      }
    };

    void runSync();

    return () => {
      cancelled = true;
    };
  }, [checkoutReference, navigate, processedCheckoutSessionId, profile, refresh, toast, upgradeState]);

  useEffect(() => {
    if (!canAccessRegistry || !weddingId) {
      setItems([]);
      setItemsError(null);
      setItemsLoading(false);
      return;
    }

    let cancelled = false;

    const loadItems = async () => {
      setItemsLoading(true);
      setItemsError(null);

      const db = supabase as any;
      const { data, error } = await db
        .from('wedding_registry_items')
        .select('*')
        .eq('wedding_id', weddingId);

      if (cancelled) return;

      if (error) {
        console.error('Failed to load registry items:', error);
        setItems([]);
        setItemsError(error.message || 'Could not load registry items.');
        setItemsLoading(false);
        return;
      }

      setItems(sortRegistryItems(((data ?? []) as any[]).map(normalizeRegistryItem)));
      setItemsLoading(false);
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [canAccessRegistry, weddingId]);

  const stats = useMemo(() => {
    const purchasedCount = items.filter((item) => item.is_purchased).length;
    const activeItems = items.filter((item) => !item.is_purchased).length;
    const totalEstimatedValue = items.reduce((sum, item) => sum + (item.estimated_price_kes ?? 0), 0);

    return {
      totalItems: items.length,
      purchasedCount,
      activeItems,
      totalEstimatedValue,
    };
  }, [items]);
  const registryPrimaryAction = !decision.allowed
    ? 'Unlock the gift registry add-on'
    : items.length === 0
      ? 'Add the first gift'
      : stats.activeItems > 0
        ? 'Review needed gifts and share the list'
        : 'Review purchased gifts and add anything missing';
  const registryConciergeContext = useMemo(() => buildConciergeContext({
    page: 'Gift Registry',
    role: profile?.role,
    primaryGoal: 'Help the couple maintain a useful, current registry without duplicate or unclear gift requests.',
    nextBestAction: registryPrimaryAction,
    facts: [
      ['Registry items', stats.totalItems],
      ['Still needed', stats.activeItems],
      ['Purchased', stats.purchasedCount],
      ['Estimated value', `KES ${stats.totalEstimatedValue.toLocaleString()}`],
    ],
  }), [profile?.role, registryPrimaryAction, stats]);
  useAssistantPageContext(registryConciergeContext);

  const handleCheckout = async () => {
    if (!profile) return;

    if (profile.role !== 'couple' && !(isSuperAdmin && rolePreview === 'couple')) {
      toast({
        title: 'Couple owners purchase wedding add-ons',
        description: 'Open this page as the couple workspace owner to add Gift Registry to the wedding.',
        variant: 'destructive',
      });
      return;
    }

    if (!weddingId) {
      toast({
        title: 'Create or join a wedding first',
        description: 'Gift Registry attaches to a specific wedding workspace.',
        variant: 'destructive',
      });
      return;
    }

    if (!addon.checkoutMonthlyLookupKey) {
      toast({
        title: 'Checkout is not configured',
        description: 'This add-on does not have a checkout mapping configured yet.',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutLoading(true);
    try {
      await startCheckout({
        audience: 'couple',
        feature: 'gift_registry',
        lookupKey: addon.checkoutMonthlyLookupKey,
        cadence: 'monthly',
        weddingId,
        successPath: withCheckoutSessionId('/gift-registry?upgrade=success'),
        cancelPath: '/gift-registry?intent=upgrade&upgrade=cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem starting your payment session.',
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  const handleCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!weddingId) {
      toast({
        title: 'Create or join a wedding first',
        description: 'Gift Registry items attach to a specific wedding workspace.',
        variant: 'destructive',
      });
      return;
    }

    const title = form.title.trim();
    const estimatedPrice = form.estimatedPriceKes.trim()
      ? Number(form.estimatedPriceKes)
      : null;

    const nextErrors: Partial<Record<keyof RegistryFormState, string>> = {};
    if (!title) {
      nextErrors.title = 'Each registry item needs a clear title.';
    }
    if (estimatedPrice != null && Number.isNaN(estimatedPrice)) {
      nextErrors.estimatedPriceKes = 'Estimated price should be a number in Kenya shillings.';
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSavingItem(true);
    const db = supabase as any;

    const { data, error } = await db
      .from('wedding_registry_items')
      .insert({
        wedding_id: weddingId,
        title,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        estimated_price_kes: estimatedPrice,
        purchase_url: normalizePurchaseUrl(form.purchaseUrl),
      })
      .select('*')
      .single();

    if (error) {
      setSubmitError(error.message || 'There was a problem saving this gift.');
      toast({
        title: 'Could not add registry item',
        description: error.message || 'There was a problem saving this gift.',
        variant: 'destructive',
      });
      setSavingItem(false);
      return;
    }

    setItems((current) => sortRegistryItems([normalizeRegistryItem(data), ...current]));
    setForm(emptyForm);
    setSavingItem(false);
    toast({
      title: 'Gift added',
      description: 'The item is now on your registry.',
    });
  };

  const handleTogglePurchased = async (item: RegistryItem) => {
    setActiveItemId(item.id);
    const db = supabase as any;
    const nextPurchasedState = !item.is_purchased;

    const { data, error } = await db
      .from('wedding_registry_items')
      .update({
        is_purchased: nextPurchasedState,
        purchased_at: nextPurchasedState ? new Date().toISOString() : null,
      })
      .eq('id', item.id)
      .select('*')
      .single();

    if (error) {
      toast({
        title: 'Could not update gift',
        description: error.message || 'There was a problem updating this registry item.',
        variant: 'destructive',
      });
      setActiveItemId(null);
      return;
    }

    setItems((current) => sortRegistryItems(current.map((entry) => (
      entry.id === item.id ? normalizeRegistryItem(data) : entry
    ))));
    setActiveItemId(null);
  };

  const handleDeleteItem = (item: RegistryItem) => {
    scheduleDelete({
      id: item.id,
      title: 'Gift removed',
      description: `${item.title} was removed from the registry.`,
      commit: async () => {
        const { error } = await (supabase as any)
          .from('wedding_registry_items')
          .delete()
          .eq('id', item.id);
        if (error) throw error;
      },
      onCommit: () => setItems((current) => current.filter((entry) => entry.id !== item.id)),
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <WorkspacePageSkeleton compact />
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-card">
          <ListRowsSkeleton rows={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statusMessage && (
        <Card
          className={`border ${
            statusMessage.tone === 'success'
              ? 'border-[hsl(var(--success-soft-border))] bg-[hsl(var(--success-soft))]/60'
              : 'border-[hsl(var(--warning-soft-border))] bg-[hsl(var(--warning-soft))]/60'
          }`}
        >
          <CardContent className="px-6 py-5">
            <p className={`text-sm font-semibold uppercase tracking-[0.14em] ${statusMessage.tone === 'success' ? 'text-success' : 'text-warning'}`}>Registry status</p>
            <h2 className="workspace-h2 mt-2">{statusMessage.title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{statusMessage.body}</p>
          </CardContent>
        </Card>
      )}

      {!canAccessRegistry && !loading && !isFocusedUpgradeFlow && (
        <InlineUpgradePrompt decision={decision} />
      )}

      {!canAccessRegistry ? (
        <div className="max-w-4xl">
          <Card className="border-primary/10 shadow-card">
            <CardHeader>
              <CardTitle className="workspace-h2">Add Gift Registry to this wedding</CardTitle>
              <CardDescription>
                This add-on unlocks a dedicated registry space for gifts, tracking, and guest sharing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
                <p className="text-sm font-medium text-foreground">What this add-on gives you</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {registryHighlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button className="gap-2" onClick={() => void handleCheckout()} disabled={checkoutLoading}>
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add Gift Registry to this wedding
                </Button>
                <Button asChild variant="outline">
                  <Link to="/pricing?audience=couple">See all wedding pricing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <Card className="border-border/70 shadow-card">
            <CardContent className="space-y-5 px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    <Badge variant="secondary">Gift registry</Badge>
                  </div>
                  <div>
                    <h1 className="workspace-h1">Make gifting easy for guests</h1>
                    <p className="mt-2 text-muted-foreground">
                      Start with the gifts that matter most, then keep the list current so guests can see what is still needed.
                    </p>
                  </div>
                </div>
                <div className="min-w-[220px] rounded-2xl border border-[#f0dfc5] bg-[#fff8ec]/95 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next focus</p>
                  <p className="mt-2 font-medium text-foreground">{registryPrimaryAction}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[#d9e5f4] bg-[#f4f8fd]/90 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Items</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{stats.totalItems}</p>
                </div>
                <div className="rounded-2xl border border-[#f0dfc5] bg-[#fff8ec]/95 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Still needed</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{stats.activeItems}</p>
                </div>
                <div className="rounded-2xl border border-[#d9ead7] bg-[#f4fbf3]/90 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estimated value</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{formatKes(stats.totalEstimatedValue) ?? 'KES 0'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle className="workspace-h2">Add a gift</CardTitle>
              <CardDescription>
                Add each item once, then mark it as bought when it gets claimed or purchased.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <FormSubmitError message={submitError} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="registry-title">Gift name</Label>
                    <Input
                      id="registry-title"
                      value={form.title}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, title: event.target.value }));
                        setFormErrors((current) => ({ ...current, title: undefined }));
                        setSubmitError(null);
                      }}
                      placeholder="e.g. Dinner set"
                      required
                      aria-invalid={!!formErrors.title}
                    />
                    <FormFieldError message={formErrors.title} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registry-category">Category</Label>
                    <Input
                      id="registry-category"
                      value={form.category}
                      onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                      placeholder="e.g. Kitchen, Home, Travel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registry-price">Estimated price (KES)</Label>
                    <Input
                      id="registry-price"
                      type="number"
                      min="0"
                      step="1"
                      value={form.estimatedPriceKes}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, estimatedPriceKes: event.target.value }));
                        setFormErrors((current) => ({ ...current, estimatedPriceKes: undefined }));
                        setSubmitError(null);
                      }}
                      placeholder="e.g. 12000"
                      aria-invalid={!!formErrors.estimatedPriceKes}
                    />
                    <FormFieldError message={formErrors.estimatedPriceKes} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registry-link">Purchase link</Label>
                    <Input
                      id="registry-link"
                      value={form.purchaseUrl}
                      onChange={(event) => setForm((current) => ({ ...current, purchaseUrl: event.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registry-description">Notes</Label>
                  <Textarea
                    id="registry-description"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Color, preferred brand, or any useful note for whoever is buying this."
                    rows={3}
                  />
                </div>
                <Button type="submit" className="gap-2" disabled={savingItem}>
                  {savingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add to registry
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle className="workspace-h2">Registry items</CardTitle>
              <CardDescription>
                Keep this list current so guests and collaborators can see what is still needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {itemsError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {itemsError}
                </div>
              ) : null}

              {itemsLoading ? (
                <div className="flex min-h-[14rem] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : items.filter((item) => !pendingDeleteIds.has(item.id)).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                  <p className="font-medium text-foreground">No gifts added yet.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Start with a few clear items so your registry feels useful immediately.
                  </p>
                </div>
              ) : (
                items.filter((item) => !pendingDeleteIds.has(item.id)).map((item) => {
                  const isActiveItem = activeItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border px-5 py-4 ${
                        item.is_purchased
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : 'border-border/70 bg-background/70'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className={`workspace-h2 ${item.is_purchased ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {item.title}
                            </h3>
                            <Badge variant={item.is_purchased ? 'success' : 'outline'}>
                              {item.is_purchased ? 'Bought' : 'Needed'}
                            </Badge>
                            {item.category ? (
                              <Badge variant="outline">{item.category}</Badge>
                            ) : null}
                          </div>

                          {item.description ? (
                            <p className={`max-w-2xl text-sm leading-7 ${item.is_purchased ? 'text-muted-foreground' : 'text-foreground/80'}`}>
                              {item.description}
                            </p>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {item.estimated_price_kes != null ? (
                              <span>{formatKes(item.estimated_price_kes)}</span>
                            ) : null}
                            {normalizeExternalUrl(item.purchase_url) ? (
                              <a
                                href={normalizeExternalUrl(item.purchase_url) ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                Open link
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            {item.is_purchased && item.purchased_at ? (
                              <span>Marked bought on {new Date(item.purchased_at).toLocaleDateString()}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={item.is_purchased ? 'outline' : 'default'}
                            className="gap-2"
                            disabled={isActiveItem}
                            onClick={() => void handleTogglePurchased(item)}
                          >
                            {isActiveItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {item.is_purchased ? 'Mark as needed' : 'Mark as bought'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            disabled={isActiveItem}
                            onClick={() => void handleDeleteItem(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
