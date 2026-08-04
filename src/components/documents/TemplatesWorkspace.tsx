import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CopyPlus, Eye, FilePlus2, Layers3, Loader2, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { getKenyanDocumentTemplateStarters, type DocumentTemplateStarter } from '@/lib/documentTemplateStarters';
import { getTemplateUseCount } from '@/lib/documentMomentum';
import DocumentSummaryRail from '@/components/documents/DocumentSummaryRail';

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

function starterToDraft(starter: DocumentTemplateStarter): TemplateDraft {
  return {
    templateType: starter.templateType,
    name: starter.name,
    description: starter.description,
    defaultTitle: starter.defaultTitle,
    defaultNotes: starter.defaultNotes,
    defaultTerms: starter.defaultTerms,
    defaultItems: starter.defaultItems.length ? starter.defaultItems : [{ description: '', quantity: 1, unitPrice: 0 }],
  };
}

const numberFormatter = new Intl.NumberFormat('en-KE', {
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => `KES ${numberFormatter.format(value)}`;

function TemplatePreview({ draft, role }: { draft: TemplateDraft; role: CommercialDocumentRole }) {
  const visibleItems = draft.defaultItems.filter((item) => item.description.trim().length > 0);
  const total = visibleItems.reduce(
    (sum, item) => sum + Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
    0,
  );
  const isContract = draft.templateType === 'contract';

  return (
    <article className="mx-auto w-full max-w-3xl border border-border/80 bg-white px-6 py-7 shadow-sm sm:px-10 sm:py-9">
      <div className="flex flex-col gap-6 border-b border-border/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{role === 'planner' ? 'Planning business' : 'Vendor business'}</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">{draft.defaultTitle.trim() || draft.name.trim() || 'Untitled document'}</h2>
        </div>
        <div className="border-l-2 border-primary/35 pl-3 text-sm">
          <p className="font-medium text-foreground">{professionalTemplateTypeLabel(draft.templateType)}</p>
          <p className="mt-1 text-muted-foreground">Client details are added when you use this template.</p>
        </div>
      </div>

      {draft.description.trim() && <p className="mt-6 text-sm leading-6 text-muted-foreground">{draft.description}</p>}

      <section className="mt-7">
        <h3 className="font-display text-lg font-semibold text-foreground">{isContract ? 'What the agreement covers' : 'Services and costs'}</h3>
        {visibleItems.length > 0 ? (
          <div className="mt-3 divide-y divide-border/70 border-y border-border/70">
            {visibleItems.map((item, index) => (
              <div key={`${item.description}-${index}`} className="grid grid-cols-[1fr_auto] gap-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{item.description}</p>
                  {!isContract && <p className="mt-1 text-muted-foreground">{Number(item.quantity ?? 1)} × {formatCurrency(Number(item.unitPrice ?? 0))}</p>}
                </div>
                {!isContract && <p className="font-semibold text-foreground">{formatCurrency(Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0))}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 border-y border-border/70 py-5 text-sm text-muted-foreground">No services or clauses added yet.</p>
        )}
        {!isContract && visibleItems.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-l-2 border-primary/35 pl-3">
            <span className="text-sm text-muted-foreground">Estimated total</span>
            <strong className="font-display text-xl text-foreground">{formatCurrency(total)}</strong>
          </div>
        )}
      </section>

      {draft.defaultNotes.trim() && (
        <section className="mt-7 border-t border-border/70 pt-5">
          <h3 className="text-sm font-semibold text-foreground">Message to your client</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{draft.defaultNotes}</p>
        </section>
      )}
      {draft.defaultTerms.trim() && (
        <section className="mt-7 border-t border-border/70 pt-5">
          <h3 className="text-sm font-semibold text-foreground">Standard terms</h3>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{draft.defaultTerms}</p>
        </section>
      )}
    </article>
  );
}

export default function TemplatesWorkspace({ role }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<ProfessionalDocumentTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [createDraft, setCreateDraft] = useState<TemplateDraft>(blankTemplateDraft());
  const [previewDraft, setPreviewDraft] = useState<TemplateDraft | null>(null);
  const [detailDraft, setDetailDraft] = useState<TemplateDraft | null>(null);
  const [selectedStarter, setSelectedStarter] = useState<DocumentTemplateStarter | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const starterTemplates = useMemo(() => getKenyanDocumentTemplateStarters(role), [role]);

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

  const selectedTemplateUseCount = selectedTemplate ? getTemplateUseCount(selectedTemplate) : 0;

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
        metadata: {
          starterKey: selectedStarter?.key ?? null,
          legalNote: selectedStarter?.legalNote ?? null,
          useCount: 0,
        },
      });
      await loadTemplates(created.id);
      setCreateDraft(blankTemplateDraft());
      setCreateStep(1);
      setSelectedStarter(null);
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

  const openStarter = (starter: DocumentTemplateStarter) => {
    setSelectedStarter(starter);
    setCreateDraft(starterToDraft(starter));
    setCreateStep(1);
    setCreateOpen(true);
  };

  const continueCreate = () => {
    if (createStep === 1 && !createDraft.name.trim()) {
      toast({ title: 'Give the template a name', description: 'A short name helps you find it again.', variant: 'destructive' });
      return;
    }
    setCreateStep((current) => (current === 1 ? 2 : 3));
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
      <header className="space-y-5 border-b border-border/70 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Documents</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">Templates</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Save a structure once, then reuse it for the next client.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start sm:self-auto"><CopyPlus className="h-4 w-4" />New template</Button>
        </div>
        <DocumentSummaryRail items={[
          { label: 'Templates', value: stats.total },
          { label: 'Billing', value: stats.billing },
          { label: 'Contracts', value: stats.contracts },
          { label: 'Quotes', value: stats.quoteStarters },
        ]} />
      </header>

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
                Viewing <span className="mx-1 break-words font-medium text-foreground">{templates.length}</span> reusable starter{templates.length === 1 ? '' : 's'}
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
                        <div className="border-l-2 border-info/35 pl-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-info">Type</p>
                          <p className="mt-1 text-xs font-medium text-foreground">
                            {professionalTemplateTypeLabel(template.templateType)}
                          </p>
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
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center">
                <p className="text-sm font-medium text-foreground">Nothing selected yet</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose a starter from the library to refine it here, or create a new template if you want to capture a fresh workflow.
                </p>
                <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                  <FilePlus2 className="h-4 w-4" />
                  Create template
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedTemplate.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {detailDraft.defaultItems.filter((item) => item.description.trim().length > 0).length} saved line
                        {detailDraft.defaultItems.filter((item) => item.description.trim().length > 0).length === 1 ? '' : 's'} ready to reuse
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-l-2 border-info/35 pl-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-info">Type</p>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {professionalTemplateTypeLabel(detailDraft.templateType)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Usage</p>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {selectedTemplateUseCount} time{selectedTemplateUseCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {typeof selectedTemplate.metadata?.legalNote === 'string' && selectedTemplate.metadata.legalNote.trim().length > 0 && (
                  <div className="rounded-2xl border border-[hsl(var(--warning-soft-border))] bg-[hsl(var(--warning-soft))] px-4 py-3 text-sm leading-6 text-warning">
                    {selectedTemplate.metadata.legalNote}
                  </div>
                )}
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
                  <Label>When should you use it?</Label>
                  <Textarea rows={2} value={detailDraft.description} onChange={(event) => setDetailDraft((current) => current ? { ...current, description: event.target.value } : current)} placeholder="What is this starter best used for?" />
                </div>
                <div className="space-y-2">
                  <Label>Document title</Label>
                  <Input value={detailDraft.defaultTitle} onChange={(event) => setDetailDraft((current) => current ? { ...current, defaultTitle: event.target.value } : current)} placeholder="e.g. Photography quote for Mary & Daniel" />
                </div>
                <div className="space-y-2">
                  <Label>Message to your client</Label>
                  <Textarea rows={3} value={detailDraft.defaultNotes} onChange={(event) => setDetailDraft((current) => current ? { ...current, defaultNotes: event.target.value } : current)} placeholder="A short note the client should see." />
                </div>
                <details className="border-y border-border/70 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">Review standard terms <span className="ml-2 font-normal text-muted-foreground">Optional</span></summary>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm leading-6 text-muted-foreground">These are included automatically. Change them only when your business terms differ.</p>
                    <Textarea rows={6} value={detailDraft.defaultTerms} onChange={(event) => setDetailDraft((current) => current ? { ...current, defaultTerms: event.target.value } : current)} placeholder="Standard terms and policies." />
                  </div>
                </details>
                <div className="space-y-3 border-y border-border/70 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">What this document includes</p>
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
                      <div key={`${selectedTemplate.id}-${index}`} className={`grid gap-3 md:items-end ${detailDraft.templateType === 'contract' ? 'md:grid-cols-[1fr_auto]' : 'md:grid-cols-[1.5fr_0.6fr_0.8fr_auto]'}`}>
                        <div className="space-y-2">
                          <Label>{detailDraft.templateType === 'contract' ? 'Clause or promise' : 'Service or item'}</Label>
                          <Input value={item.description} onChange={(event) => updateDraftItem(index, { description: event.target.value }, 'detail')} />
                        </div>
                        {detailDraft.templateType !== 'contract' && (
                          <>
                            <div className="space-y-2">
                              <Label>How many</Label>
                              <Input type="number" min="0" value={item.quantity ?? 1} onChange={(event) => updateDraftItem(index, { quantity: Number(event.target.value) }, 'detail')} />
                            </div>
                            <div className="space-y-2">
                              <Label>Price each</Label>
                              <Input type="number" min="0" value={item.unitPrice ?? 0} onChange={(event) => updateDraftItem(index, { unitPrice: Number(event.target.value) }, 'detail')} />
                            </div>
                          </>
                        )}
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
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => setPreviewDraft(detailDraft)}>
                      <Eye className="h-4 w-4" />
                      Preview document
                    </Button>
                    <Button type="button" className="gap-2" onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save template'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-white/95 shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl">Kenya-ready starters</CardTitle>
          <CardDescription>
            Start from a practical quote, invoice, receipt, or contract outline, then amend it to match your business, taxes, and engagement terms.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {starterTemplates.map((starter) => (
            <div key={starter.key} className="rounded-2xl border border-border bg-muted/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="border-l-2 border-info/35 pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-info">Starter</p>
                  <p className="mt-1 text-xs font-medium text-foreground">
                    {professionalTemplateTypeLabel(starter.templateType)}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => openStarter(starter)}>
                  Start with this
                </Button>
              </div>
              <p className="mt-3 font-semibold text-foreground">{starter.name}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{starter.description}</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{starter.legalNote}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) {
          setSelectedStarter(null);
          setCreateStep(1);
          setCreateDraft(blankTemplateDraft());
        }
      }}>
        <DialogContent className="flex max-h-[88vh] w-[min(94vw,52rem)] max-w-[52rem] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5">
            <DialogTitle>{selectedStarter ? 'Set up your template' : 'Create a template'}</DialogTitle>
            <p className="text-sm leading-6 text-muted-foreground">Answer a few simple questions. You can change everything later.</p>
            <div className="grid grid-cols-3 gap-3 pt-2" aria-label={`Step ${createStep} of 3`}>
              {['Name it', 'Add your work', 'Check it'].map((label, index) => {
                const step = (index + 1) as 1 | 2 | 3;
                return (
                  <div key={label} className={`border-t-2 pt-2 text-xs font-medium ${step <= createStep ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}>
                    {index + 1}. {label}
                  </div>
                );
              })}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {createStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">What do you want to reuse?</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Give this starter a name you will recognize next time.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Template name</Label>
                    <Input value={createDraft.name} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Standard photography quote" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select value={createDraft.templateType} onValueChange={(value) => setCreateDraft((current) => ({ ...current, templateType: value as ProfessionalTemplateType }))}>
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
                  <Label>When should you use it?</Label>
                  <Textarea rows={2} value={createDraft.description} onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))} placeholder="e.g. Use this when a couple asks for full-day photography." />
                </div>
                <div className="space-y-2">
                  <Label>Document title</Label>
                  <Input value={createDraft.defaultTitle} onChange={(event) => setCreateDraft((current) => ({ ...current, defaultTitle: event.target.value }))} placeholder="This appears at the top of the document." />
                </div>
                <div className="space-y-2">
                  <Label>Message to your client <span className="font-normal text-muted-foreground">· Optional</span></Label>
                  <Textarea rows={3} value={createDraft.defaultNotes} onChange={(event) => setCreateDraft((current) => ({ ...current, defaultNotes: event.target.value }))} placeholder="A short welcome, thank-you, or explanation." />
                </div>
                {selectedStarter && <p className="border-l-2 border-warning/40 pl-3 text-sm leading-6 text-muted-foreground">Zania has already filled in a practical starting point for you.</p>}
              </div>
            )}

            {createStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">{createDraft.templateType === 'contract' ? 'What should the agreement cover?' : 'What are you offering?'}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Add only the lines you use often. Client-specific details come later.</p>
                </div>
                <div className="space-y-4 border-y border-border/70 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{createDraft.templateType === 'contract' ? 'Agreement points' : 'Services and prices'}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => addItem('create')}>Add another</Button>
                  </div>
                  <div className="space-y-3">
                    {createDraft.defaultItems.map((item, index) => (
                      <div key={`create-${index}`} className={`grid gap-3 md:items-end ${createDraft.templateType === 'contract' ? 'md:grid-cols-[1fr_auto]' : 'md:grid-cols-[1.5fr_0.6fr_0.8fr_auto]'}`}>
                        <div className="space-y-2">
                          <Label>{createDraft.templateType === 'contract' ? 'Clause or promise' : 'Service or item'}</Label>
                          <Input value={item.description} onChange={(event) => updateDraftItem(index, { description: event.target.value }, 'create')} />
                        </div>
                        {createDraft.templateType !== 'contract' && (
                          <>
                            <div className="space-y-2">
                              <Label>How many</Label>
                              <Input type="number" min="0" value={item.quantity ?? 1} onChange={(event) => updateDraftItem(index, { quantity: Number(event.target.value) }, 'create')} />
                            </div>
                            <div className="space-y-2">
                              <Label>Price each</Label>
                              <Input type="number" min="0" value={item.unitPrice ?? 0} onChange={(event) => updateDraftItem(index, { unitPrice: Number(event.target.value) }, 'create')} />
                            </div>
                          </>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeItem(index, 'create')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <details className="border-b border-border/70 pb-4">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">Review standard terms <span className="ml-2 font-normal text-muted-foreground">Optional</span></summary>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm leading-6 text-muted-foreground">These are included automatically. You only need to open this when your business terms differ.</p>
                    <Textarea rows={6} value={createDraft.defaultTerms} onChange={(event) => setCreateDraft((current) => ({ ...current, defaultTerms: event.target.value }))} placeholder="Standard terms and policies." />
                    {selectedStarter && <p className="text-xs leading-5 text-warning">{selectedStarter.legalNote}</p>}
                  </div>
                </details>
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">Does this look right?</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">This is what your reusable starting point will look like. Client details are added when you use it.</p>
                </div>
                <TemplatePreview draft={createDraft} role={role} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-background px-6 py-4">
            <Button type="button" variant="ghost" className="gap-2" onClick={() => setCreateStep((current) => (current === 3 ? 2 : 1))} disabled={createStep === 1}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              {createStep < 3 && (
                <Button type="button" variant="outline" className="gap-2" onClick={() => setPreviewDraft(createDraft)}>
                  <Eye className="h-4 w-4" />
                  Preview document
                </Button>
              )}
              {createStep < 3 ? (
                <Button type="button" className="gap-2" onClick={continueCreate}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="gap-2" onClick={handleCreate} disabled={creating}>
                  <FilePlus2 className="h-4 w-4" />
                  {creating ? 'Saving...' : 'Save template'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewDraft)} onOpenChange={(open) => !open && setPreviewDraft(null)}>
        <DialogContent className="flex max-h-[90vh] w-[min(94vw,58rem)] max-w-[58rem] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5">
            <DialogTitle>Document preview</DialogTitle>
            <p className="text-sm text-muted-foreground">A client-ready check before you save. Nothing has been sent.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6">
            {previewDraft && <TemplatePreview draft={previewDraft} role={role} />}
          </div>
          <div className="flex shrink-0 justify-end border-t border-border/70 bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setPreviewDraft(null)}>Back to editing</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
