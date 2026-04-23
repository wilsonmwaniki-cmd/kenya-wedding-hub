import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Gift, Loader2, ShoppingBag, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { startStripeCheckout } from '@/lib/billing';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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
  const { toast } = useToast();
  const { profile, isSuperAdmin, rolePreview } = useAuth();
  const { weddingId, entitlements, couplePlanTier, loading } = useWeddingEntitlements();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [form, setForm] = useState<RegistryFormState>(emptyForm);

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

    if (!addon.stripeMonthlyLookupKey) {
      toast({
        title: 'Checkout is not configured',
        description: 'This add-on does not have a Stripe price configured yet.',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutLoading(true);
    try {
      await startStripeCheckout({
        audience: 'couple',
        feature: 'gift_registry',
        lookupKey: addon.stripeMonthlyLookupKey,
        cadence: 'monthly',
        weddingId,
        successPath: '/gift-registry?upgrade=success',
        cancelPath: '/gift-registry?intent=upgrade&upgrade=cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem creating your Stripe checkout session.',
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  const handleCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!weddingId) {
      toast({
        title: 'Create or join a wedding first',
        description: 'Gift Registry items attach to a specific wedding workspace.',
        variant: 'destructive',
      });
      return;
    }

    const title = form.title.trim();
    if (!title) {
      toast({
        title: 'Add a gift name',
        description: 'Each registry item needs a clear title.',
        variant: 'destructive',
      });
      return;
    }

    const estimatedPrice = form.estimatedPriceKes.trim()
      ? Number(form.estimatedPriceKes)
      : null;

    if (estimatedPrice != null && Number.isNaN(estimatedPrice)) {
      toast({
        title: 'Use a valid price',
        description: 'Estimated price should be a number in Kenya shillings.',
        variant: 'destructive',
      });
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

  const handleDeleteItem = async (item: RegistryItem) => {
    if (!window.confirm(`Remove "${item.title}" from the registry?`)) return;

    setActiveItemId(item.id);
    const db = supabase as any;
    const { error } = await db
      .from('wedding_registry_items')
      .delete()
      .eq('id', item.id);

    if (error) {
      toast({
        title: 'Could not remove gift',
        description: error.message || 'There was a problem deleting this registry item.',
        variant: 'destructive',
      });
      setActiveItemId(null);
      return;
    }

    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setActiveItemId(null);
    toast({
      title: 'Gift removed',
      description: 'The item was removed from the registry.',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <Badge variant="secondary">Add-on</Badge>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Gift Registry</h1>
          <p className="max-w-2xl text-muted-foreground">
            Keep one clear list of gifts you want, with links, price notes, and a simple bought or still-needed status.
          </p>
        </div>
      </div>

      {statusMessage && (
        <Card className={`border ${statusMessage.tone === 'success' ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
          <CardContent className="px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Registry status</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">{statusMessage.title}</h2>
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
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Add Gift Registry to this wedding
              </CardTitle>
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
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/70 shadow-card">
              <CardContent className="px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Registry items</p>
                <p className="mt-2 font-display text-3xl font-semibold">{stats.totalItems}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-card">
              <CardContent className="px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Still needed</p>
                <p className="mt-2 font-display text-3xl font-semibold">{stats.activeItems}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-card">
              <CardContent className="px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estimated value</p>
                <p className="mt-2 font-display text-3xl font-semibold">{formatKes(stats.totalEstimatedValue) ?? 'KES 0'}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Add a gift</CardTitle>
              <CardDescription>
                Add each item once, then mark it as bought when it gets claimed or purchased.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="registry-title">Gift name</Label>
                    <Input
                      id="registry-title"
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="e.g. Dinner set"
                      required
                    />
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
                      onChange={(event) => setForm((current) => ({ ...current, estimatedPriceKes: event.target.value }))}
                      placeholder="e.g. 12000"
                    />
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
              <CardTitle className="font-display text-2xl">Registry items</CardTitle>
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
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                  <p className="font-medium text-foreground">No gifts added yet.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Start with a few clear items so your registry feels useful immediately.
                  </p>
                </div>
              ) : (
                items.map((item) => {
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
                            <h3 className={`font-display text-2xl font-semibold ${item.is_purchased ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {item.title}
                            </h3>
                            <Badge variant={item.is_purchased ? 'secondary' : 'outline'}>
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
                            {item.purchase_url ? (
                              <a
                                href={item.purchase_url}
                                target="_blank"
                                rel="noreferrer"
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
