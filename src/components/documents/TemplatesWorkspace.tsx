import { useEffect, useMemo, useState } from 'react';
import { CopyPlus, FilePlus2, Layers3, Loader2, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  listDocumentTemplates,
  professionalTemplateTypeLabel,
  professionalTemplateTypeOptions,
  updateDocumentTemplate,
  type CommercialDocumentRole,
  type DocumentTemplateItem,
  type ProfessionalDocumentTemplateRecord,
  type ProfessionalTemplateType,
} from '@/lib/commercialDocuments';

type TemplateDraft = {
  templateType: ProfessionalTemplateType;
  name: string;
  description: string;
  defaultTitle: string;
  defaultNotes: string;
  defaultTerms: string;
  defaultItems: DocumentTemplateItem[];
};

type Props = {
  role: CommercialDocumentRole;
};

function blankTemplateDraft(): TemplateDraft {
  return {
    templateType: 'quote',
    name: '',
    description: '',
    defaultTitle: '',
    defaultNotes: '',
    defaultTerms: '',
    defaultItems: [{ description: '', quantity: 1, unitPrice: 0 }],
  };
}

export default function TemplatesWorkspace({ role }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<ProfessionalDocumentTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<TemplateDraft>(blankTemplateDraft());
  const [detailDraft, setDetailDraft] = useState<TemplateDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTemplates = async (preferredId?: string | null) => {
    const next = await listDocumentTemplates({ role, search: search.trim() || undefined });
    setTemplates(next);
    setSelectedId((current) => {
      if (preferredId && next.some((item) => item.id === preferredId)) return preferredId;
      if (current && next.some((item) => item.id === current)) return current;
      return next[0]?.id ?? null;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadTemplates();
      } catch (error) {
        console.error('Could not load templates workspace:', error);
        toast({ title: 'Could not load templates', description: 'Please try again in a moment.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setRefreshing(true);
      try {
        await loadTemplates(selectedId);
      } catch (error) {
        console.error('Could not refresh templates:', error);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [search]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setDetailDraft(null);
      return;
    }
    setDetailDraft({
      templateType: selectedTemplate.templateType,
      name: selectedTemplate.name,
      description: selectedTemplate.description ?? '',
      defaultTitle: selectedTemplate.defaultTitle ?? '',
      defaultNotes: selectedTemplate.defaultNotes ?? '',
      defaultTerms: selectedTemplate.defaultTerms ?? '',
      defaultItems:
        selectedTemplate.defaultItems.length > 0
          ? selectedTemplate.defaultItems
          : [{ description: '', quantity: 1, unitPrice: 0 }],
    });
  }, [selectedTemplate?.id]);

  const stats = useMemo(() => ({
    total: templates.length,
    billing: templates.filter((item) => item.templateType !== 'contract').length,
    contracts: templates.filter((item) => item.templateType === 'contract').length,
    quoteStarters: templates.filter((item) => item.templateType === 'quote').length,
  }), [templates]);

  const sanitizedItems = (items: DocumentTemplateItem[]) =>
    items
      .map((item) => ({
        description: item.description?.trim() || '',
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? 0),
      }))
      .filter((item) => item.description.length > 0);

  const handleCreate = async () => {
    if (!createDraft.name.trim()) {
      toast({ title: 'Give the template a name', description: 'That makes it easier to find later.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const created = await createDocumentTemplate({
        role,
        templateType: createDraft.templateType,
        name: createDraft.name.trim(),
        description: createDraft.description.trim() || null,
        defaultTitle: createDraft.defaultTitle.trim() || null,
        defaultNotes: createDraft.defaultNotes.trim() || null,
        defaultTerms: createDraft.defaultTerms.trim() || null,
        defaultItems: sanitizedItems(createDraft.defaultItems),
      });
      await loadTemplates(created.id);
      setCreateDraft(blankTemplateDraft());
      setCreateOpen(false);
      toast({ title: 'Template saved', description: 'You can now reuse this as a starting point later.' });
    } catch (error) {
      console.error('Could not create template:', error);
      toast({ title: 'Could not create template', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate || !detailDraft) return;
    setSaving(true);
    try {
      await updateDocumentTemplate(selectedTemplate.id, {
        templateType: detailDraft.templateType,
        name: detailDraft.name.trim(),
        description: detailDraft.description.trim() || null,
        defaultTitle: detailDraft.defaultTitle.trim() || null,
        defaultNotes: detailDraft.defaultNotes.trim() || null,
        defaultTerms: detailDraft.defaultTerms.trim() || null,
        defaultItems: sanitizedItems(detailDraft.defaultItems),
      });
      await loadTemplates(selectedTemplate.id);
      toast({ title: 'Template updated', description: 'Your reusable starter is up to date.' });
    } catch (error) {
      console.error('Could not save template:', error);
      toast({ title: 'Could not save template', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (!window.confirm(`Delete ${selectedTemplate.name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDocumentTemplate(selectedTemplate.id);
      await loadTemplates(null);
      toast({ title: 'Template deleted' });
    } catch (error) {
      console.error('Could not delete template:', error);
      toast({ title: 'Could not delete template', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const updateDraftItem = (index: number, patch: Partial<DocumentTemplateItem>, target: 'create' | 'detail') => {
    const updater = target === 'create' ? setCreateDraft : setDetailDraft;
    updater((current) => {
      if (!current) return current;
      const nextItems = [...current.defaultItems];
      nextItems[index] = { ...nextItems[index], ...patch };
      return { ...current, defaultItems: nextItems };
    });
  };

  const addItem = (target: 'create' | 'detail') => {
    const updater = target === 'create' ? setCreateDraft : setDetailDraft;
    updater((current) => {
      if (!current) return current;
      return {
        ...current,
        defaultItems: [...current.defaultItems, { description: '', quantity: 1, unitPrice: 0 }],
      };
    });
  };

  const removeItem = (index: number, target: 'create' | 'detail') => {
    const updater = target === 'create' ? setCreateDraft : setDetailDraft;
    updater((current) => {
      if (!current) return current;
      const nextItems = current.defaultItems.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        defaultItems: nextItems.length ? nextItems : [{ description: '', quantity: 1, unitPrice: 0 }],
      };
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Opening templates workspace...
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <Card className="border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.08),rgba(255,255,255,0.98)_32%,rgba(255,247,242,0.9))] shadow-card">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Reusable starters</p>
            <CardTitle className="font-display text-[2.1rem] leading-tight text-foreground">Templates</CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Save your standard quote, invoice, receipt, and contract building blocks so the next document starts faster.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start">
            <CopyPlus className="h-4 w-4" />
            New template
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-border/70 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Templates</p>
            <p className="mt-2 break-words text-2xl font-semibold leading-tight text-foreground">{stats.total}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border/70 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Billing starters</p>
            <p className="mt-2 break-words text-2xl font-semibold leading-tight text-foreground">{stats.billing}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border/70 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contract starters</p>
            <p className="mt-2 break-words text-2xl font-semibold leading-tight text-foreground">{stats.contracts}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border/70 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Quote starters</p>
            <p className="mt-2 break-words text-2xl font-semibold leading-tight text-foreground">{stats.quoteStarters}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 bg-white/95 shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl">Template library</CardTitle>
                <CardDescription>Keep your go-to document structures together in one calmer place.</CardDescription>
              </div>
              {refreshing && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Refreshing</div>}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by template name or default title" />
              <div className="flex min-h-12 items-center rounded-xl border border-border bg-muted/20 px-4 py-2 text-sm leading-5 text-muted-foreground">
                Viewing <span className="mx-1 break-words font-medium text-foreground">reusable starters</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                <Layers3 className="mx-auto mb-3 h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">No templates yet</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Build your favorite quote, invoice, receipt, and contract starters here so repeat work gets lighter.</p>
                <Button className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                  <FilePlus2 className="h-4 w-4" />
                  Create first template
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="hidden grid-cols-[1.2fr_0.9fr_1.5fr] gap-4 border-b border-border bg-muted/20 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:grid">
                  <span>Template</span>
                  <span>Type</span>
                  <span>Default title</span>
                </div>
                <div className="divide-y divide-border">
                  {templates.map((template) => {
                    const active = template.id === selectedId;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedId(template.id)}
                        className={`grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[1.2fr_0.9fr_1.5fr] md:items-center ${active ? 'bg-primary/6' : 'bg-card hover:bg-muted/10'}`}
                      >
                        <div className="min-w-0">
                          <p className="break-words font-semibold leading-5 text-foreground">{template.name}</p>
                          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{template.description || 'No description yet'}</p>
                        </div>
                        <div>
                          <Badge variant="secondary">{professionalTemplateTypeLabel(template.templateType)}</Badge>
                        </div>
                        <div className="min-w-0 break-words text-sm leading-5 text-muted-foreground">{template.defaultTitle || 'No default title yet'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-white/95 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-xl">Template details</CardTitle>
            <CardDescription>
              {selectedTemplate ? 'Adjust the reusable starter here.' : 'Pick a template on the left to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedTemplate || !detailDraft ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center text-sm text-muted-foreground">
                Pick a template from the library to continue.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Template name</Label>
                    <Input value={detailDraft.name} onChange={(event) => setDetailDraft((current) => current ? { ...current, name: event.target.value } : current)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Template type</Label>
                    <Select value={detailDraft.templateType} onValueChange={(value) => setDetailDraft((current) => current ? { ...current, templateType: value as ProfessionalTemplateType } : current)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {professionalTemplateTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>{professionalTemplateTypeLabel(type)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={detailDraft.description} onChange={(event) => setDetailDraft((current) => current ? { ...current, description: event.target.value } : current)} placeholder="What is this starter best used for?" />
                </div>
                <div className="space-y-2">
                  <Label>Default title</Label>
                  <Input value={detailDraft.defaultTitle} onChange={(event) => setDetailDraft((current) => current ? { ...current, defaultTitle: event.target.value } : current)} placeholder="e.g. Photography quote for Mary & Daniel" />
                </div>
                <div className="space-y-2">
                  <Label>Default terms</Label>
                  <Textarea rows={6} value={detailDraft.defaultTerms} onChange={(event) => setDetailDraft((current) => current ? { ...current, defaultTerms: event.target.value } : current)} placeholder="Standard terms, policies, and defaults." />
                </div>
                <div className="space-y-2">
                  <Label>Default notes</Label>
                  <Textarea rows={3} value={detailDraft.defaultNotes} onChange={(event) => setDetailDraft((current) => current ? { ...current, defaultNotes: event.target.value } : current)} placeholder="Helpful notes or prep reminders." />
                </div>
                <div className="space-y-3 rounded-2xl border border-border bg-muted/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Default items</p>
                      <p className="text-sm text-muted-foreground">
                        {detailDraft.templateType === 'contract'
                          ? 'Use these as reusable clause starters or scope bullets.'
                          : 'These become the service lines you reach for most often.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => addItem('detail')}>Add item</Button>
                  </div>
                  <div className="space-y-3">
                    {detailDraft.defaultItems.map((item, index) => (
                      <div key={`${selectedTemplate.id}-${index}`} className="grid gap-3 md:grid-cols-[1.5fr_0.6fr_0.8fr_auto] md:items-end">
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input value={item.description} onChange={(event) => updateDraftItem(index, { description: event.target.value }, 'detail')} />
                        </div>
                        <div className="space-y-2">
                          <Label>Qty</Label>
                          <Input type="number" min="0" value={item.quantity ?? 1} onChange={(event) => updateDraftItem(index, { quantity: Number(event.target.value) }, 'detail')} />
                        </div>
                        <div className="space-y-2">
                          <Label>{detailDraft.templateType === 'contract' ? 'Value' : 'Unit price'}</Label>
                          <Input type="number" min="0" value={item.unitPrice ?? 0} onChange={(event) => updateDraftItem(index, { unitPrice: Number(event.target.value) }, 'detail')} />
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeItem(index, 'detail')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="h-4 w-4" />
                    {deleting ? 'Deleting...' : 'Delete template'}
                  </Button>
                  <Button type="button" className="gap-2" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save template'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Template name</Label>
              <Input value={createDraft.name} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Standard photography quote" />
            </div>
            <div className="space-y-2">
              <Label>Template type</Label>
              <Select value={createDraft.templateType} onValueChange={(value) => setCreateDraft((current) => ({ ...current, templateType: value as ProfessionalTemplateType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {professionalTemplateTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>{professionalTemplateTypeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={createDraft.description} onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))} placeholder="When should you reach for this starter?" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Default title</Label>
              <Input value={createDraft.defaultTitle} onChange={(event) => setCreateDraft((current) => ({ ...current, defaultTitle: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Default terms</Label>
              <Textarea rows={6} value={createDraft.defaultTerms} onChange={(event) => setCreateDraft((current) => ({ ...current, defaultTerms: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Default notes</Label>
              <Textarea rows={3} value={createDraft.defaultNotes} onChange={(event) => setCreateDraft((current) => ({ ...current, defaultNotes: event.target.value }))} />
            </div>
            <div className="space-y-3 rounded-2xl border border-border bg-muted/10 p-4 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Default items</p>
                  <p className="text-sm text-muted-foreground">Save the lines or clauses you repeat most often.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('create')}>Add item</Button>
              </div>
              <div className="space-y-3">
                {createDraft.defaultItems.map((item, index) => (
                  <div key={`create-${index}`} className="grid gap-3 md:grid-cols-[1.5fr_0.6fr_0.8fr_auto] md:items-end">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={item.description} onChange={(event) => updateDraftItem(index, { description: event.target.value }, 'create')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Qty</Label>
                      <Input type="number" min="0" value={item.quantity ?? 1} onChange={(event) => updateDraftItem(index, { quantity: Number(event.target.value) }, 'create')} />
                    </div>
                    <div className="space-y-2">
                      <Label>{createDraft.templateType === 'contract' ? 'Value' : 'Unit price'}</Label>
                      <Input type="number" min="0" value={item.unitPrice ?? 0} onChange={(event) => updateDraftItem(index, { unitPrice: Number(event.target.value) }, 'create')} />
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeItem(index, 'create')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleCreate} disabled={creating}>
              <FilePlus2 className="h-4 w-4" />
              {creating ? 'Creating...' : 'Create template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
