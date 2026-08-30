import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { WorkspacePageSkeleton, ListRowsSkeleton } from '@/components/AppLoadingSkeletons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { normalizeExternalUrl } from '@/lib/security';
import { useDeferredDelete } from '@/hooks/useDeferredDelete';

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
  const { toast } = useToast();
  const { pendingIds: pendingDeleteIds, scheduleDelete } = useDeferredDelete();
  const { profile } = useAuth();
  const { weddingId, loading } = useWeddingEntitlements();
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [form, setForm] = useState<RegistryFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RegistryFormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addGiftOpen, setAddGiftOpen] = useState(false);

  const canAccessRegistry = Boolean(weddingId);

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
    setAddGiftOpen(false);
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
      {!canAccessRegistry ? (
        <div className="max-w-4xl">
          <Card className="border-primary/10 shadow-card">
            <CardHeader>
              <CardTitle className="workspace-h2">Create your wedding workspace first</CardTitle>
              <CardDescription>Gift registry becomes available when your wedding workspace is ready.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="workspace-h1">Gift registry</h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">Keep a private list of gifts you would like.</p>
            </div>
            {items.length > 0 ? (
              <Button onClick={() => setAddGiftOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add gift
              </Button>
            ) : null}
          </div>

          {items.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background px-4 py-4"><p className="text-xs text-muted-foreground">Gifts</p><p className="mt-1 text-2xl font-semibold">{stats.totalItems}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background px-4 py-4"><p className="text-xs text-muted-foreground">Needed</p><p className="mt-1 text-2xl font-semibold">{stats.activeItems}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background px-4 py-4"><p className="text-xs text-muted-foreground">Estimated value</p><p className="mt-1 text-2xl font-semibold">{formatKes(stats.totalEstimatedValue) ?? 'KES 0'}</p></div>
            </div>
          ) : null}

          <Dialog open={addGiftOpen} onOpenChange={setAddGiftOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add gift</DialogTitle>
                <DialogDescription>Add a gift to your private list.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <FormSubmitError message={submitError} />
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
                <details className="rounded-2xl border border-border/70 p-4">
                  <summary className="cursor-pointer list-none text-sm font-medium text-foreground">More details</summary>
                  <div className="mt-4 space-y-4">
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
                    <div className="space-y-2">
                      <Label htmlFor="registry-description">Notes</Label>
                      <Textarea
                        id="registry-description"
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Add a note"
                        rows={3}
                      />
                    </div>
                  </div>
                </details>
                <Button type="submit" className="w-full gap-2" disabled={savingItem}>
                  {savingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add gift
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle className="workspace-h2">Gifts</CardTitle>
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
                  <p className="font-medium text-foreground">No gifts yet.</p>
                  <Button className="mt-4 gap-2" onClick={() => setAddGiftOpen(true)}>
                    <Plus className="h-4 w-4" /> Add gift
                  </Button>
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
                            variant="ghost"
                            className="gap-2 text-muted-foreground hover:text-destructive"
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
