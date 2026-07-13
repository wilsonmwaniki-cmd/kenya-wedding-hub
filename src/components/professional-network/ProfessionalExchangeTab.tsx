import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageSquareText,
  Send,
  Store,
  Users,
} from 'lucide-react';

import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { kenyaCounties } from '@/lib/kenyaLocations';
import {
  professionalExchangeCategories,
  professionalExchangeCategoryMeta,
  professionalExchangeUrgencies,
  professionalExchangeUrgencyMeta,
  type ProfessionalExchangeCategory,
  type ProfessionalExchangeUrgency,
  type ProfessionalNetworkRole,
} from '@/lib/professionalNetwork';
import { cn } from '@/lib/utils';

type PlannerPeer = {
  id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  primary_county: string | null;
  founding_planner_contributor: boolean;
};

type VendorPeer = {
  id: string;
  user_id: string | null;
  business_name: string;
  category: string;
  location_county: string | null;
  profile_kind: 'claimed' | 'curated' | 'featured';
  is_verified: boolean;
};

type VendorListingSummary = {
  id: string;
  business_name: string;
  location_county: string | null;
};

type ProfessionalExchangeQuestion = {
  id: string;
  author_user_id: string;
  author_role: 'planner' | 'vendor' | 'admin';
  author_vendor_listing_id: string | null;
  title: string;
  body: string;
  category: ProfessionalExchangeCategory;
  urgency: ProfessionalExchangeUrgency;
  location_county: string | null;
  is_resolved: boolean;
  best_answer_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfessionalExchangeAnswer = {
  id: string;
  question_id: string;
  author_user_id: string;
  author_role: 'planner' | 'vendor' | 'admin';
  author_vendor_listing_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

type ProfessionalExchangeTabProps = {
  db: any;
  userId: string;
  role: ProfessionalNetworkRole;
  profile: {
    full_name?: string | null;
    company_name?: string | null;
    primary_county?: string | null;
    role?: string | null;
    founding_planner_contributor?: boolean | null;
  } | null;
  vendorListing: VendorListingSummary | null;
  plannerPeers: PlannerPeer[];
  vendorPeers: VendorPeer[];
  onToast: (input: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
};

const initialQuestionDraft = {
  title: '',
  body: '',
  category: 'sourcing' as ProfessionalExchangeCategory,
  urgency: 'planning' as ProfessionalExchangeUrgency,
  locationCounty: '',
};

function formatExchangeTimestamp(value: string) {
  return new Date(value).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAuthorMeta(
  currentUserId: string,
  currentRole: ProfessionalNetworkRole,
  profile: ProfessionalExchangeTabProps['profile'],
  vendorListing: VendorListingSummary | null,
  plannerPeers: PlannerPeer[],
  vendorPeers: VendorPeer[],
  entry: ProfessionalExchangeQuestion | ProfessionalExchangeAnswer,
) {
  const isCurrentUser = entry.author_user_id === currentUserId;
  const ownPlannerTrust = currentRole === 'planner' ? Boolean(profile?.founding_planner_contributor) : false;
  if (entry.author_role === 'planner') {
    const planner = plannerPeers.find((item) => item.user_id === entry.author_user_id);
    const isFounding = isCurrentUser ? ownPlannerTrust : Boolean(planner?.founding_planner_contributor);

    return {
      label: isCurrentUser ? 'You' : planner?.company_name || planner?.full_name || 'Planner',
      roleLabel: 'Planner',
      county: planner?.primary_county || profile?.primary_county || null,
      trustLabel: isFounding ? 'Founding planner' : null,
    };
  }

  const vendor = entry.author_vendor_listing_id
    ? vendorPeers.find((item) => item.id === entry.author_vendor_listing_id)
    : null;

  return {
    label: isCurrentUser
      ? vendorListing?.business_name || 'You'
      : vendor?.business_name || 'Vendor',
    roleLabel: 'Vendor',
    county: vendor?.location_county || vendorListing?.location_county || null,
    trustLabel: vendor?.is_verified ? 'Verified vendor' : vendor?.profile_kind === 'featured' ? 'Featured vendor' : null,
  };
}

export default function ProfessionalExchangeTab({
  db,
  userId,
  role,
  profile,
  vendorListing,
  plannerPeers,
  vendorPeers,
  onToast,
}: ProfessionalExchangeTabProps) {
  const [loading, setLoading] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [questions, setQuestions] = useState<ProfessionalExchangeQuestion[]>([]);
  const [answers, setAnswers] = useState<ProfessionalExchangeAnswer[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState(initialQuestionDraft);
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  const [questionSubmitError, setQuestionSubmitError] = useState<string | null>(null);
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'all' | ProfessionalExchangeCategory>('all');
  const [filterCounty, setFilterCounty] = useState<'all' | string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [answerSubmittingId, setAnswerSubmittingId] = useState<string | null>(null);
  const [resolveSubmittingId, setResolveSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [questionRes, answerRes] = await Promise.all([
        db
          .from('professional_exchange_questions')
          .select('*')
          .order('is_resolved', { ascending: true })
          .order('created_at', { ascending: false }),
        db
          .from('professional_exchange_answers')
          .select('*')
          .order('created_at', { ascending: true }),
      ]);

      if (questionRes.error || answerRes.error) {
        const errorText = `${questionRes.error?.message ?? ''} ${answerRes.error?.message ?? ''}`;
        if (errorText.toLowerCase().includes('professional_exchange_')) {
          setBackendUnavailable(true);
          setLoading(false);
          return;
        }
      }

      setQuestions((questionRes.data as ProfessionalExchangeQuestion[] | null) ?? []);
      setAnswers((answerRes.data as ProfessionalExchangeAnswer[] | null) ?? []);
      setSelectedQuestionId((current) => current ?? (questionRes.data as ProfessionalExchangeQuestion[] | null)?.[0]?.id ?? null);
      setLoading(false);
    };

    void load();
  }, [db]);

  const answersByQuestionId = useMemo(() => {
    return answers.reduce<Record<string, ProfessionalExchangeAnswer[]>>((accumulator, answer) => {
      accumulator[answer.question_id] = [...(accumulator[answer.question_id] ?? []), answer];
      return accumulator;
    }, {});
  }, [answers]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      if (filterCategory !== 'all' && question.category !== filterCategory) return false;
      if (filterCounty !== 'all' && question.location_county !== filterCounty) return false;
      if (filterStatus === 'open' && question.is_resolved) return false;
      if (filterStatus === 'resolved' && !question.is_resolved) return false;
      return true;
    });
  }, [filterCategory, filterCounty, filterStatus, questions]);

  const selectedQuestion = useMemo(
    () => filteredQuestions.find((question) => question.id === selectedQuestionId) ?? filteredQuestions[0] ?? null,
    [filteredQuestions, selectedQuestionId],
  );

  useEffect(() => {
    if (!selectedQuestion && filteredQuestions.length === 0) {
      setSelectedQuestionId(null);
      return;
    }
    if (selectedQuestion?.id !== selectedQuestionId) {
      setSelectedQuestionId(selectedQuestion?.id ?? null);
    }
  }, [filteredQuestions, selectedQuestion, selectedQuestionId]);

  const exchangeStats = useMemo(() => {
    const openCount = questions.filter((question) => !question.is_resolved).length;
    const urgentCount = questions.filter((question) => question.urgency === 'event_day' && !question.is_resolved).length;
    return {
      total: questions.length,
      open: openCount,
      resolved: questions.filter((question) => question.is_resolved).length,
      urgent: urgentCount,
    };
  }, [questions]);

  const topCategories = useMemo(() => {
    const counts = questions.reduce<Record<string, number>>((accumulator, question) => {
      accumulator[question.category] = (accumulator[question.category] ?? 0) + 1;
      return accumulator;
    }, {});

    return professionalExchangeCategories
      .map((category) => ({
        category,
        count: counts[category] ?? 0,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 3);
  }, [questions]);

  const canMarkBestAnswer = (question: ProfessionalExchangeQuestion) => question.author_user_id === userId;

  const handleQuestionDraftChange = <K extends keyof typeof initialQuestionDraft>(key: K, value: (typeof initialQuestionDraft)[K]) => {
    setQuestionDraft((current) => ({ ...current, [key]: value }));
  };

  const handleAskQuestion = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!questionDraft.title.trim()) nextErrors.title = 'Add a clear subject so the right professionals open it.';
    if (questionDraft.title.trim().length < 12) nextErrors.title = 'Make the title a little more specific.';
    if (!questionDraft.body.trim()) nextErrors.body = 'Describe what you need, the context, and what you have tried.';
    if (questionDraft.body.trim().length < 40) nextErrors.body = 'A little more detail will get better answers.';
    setQuestionErrors(nextErrors);
    setQuestionSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setQuestionSubmitting(true);

    if (backendUnavailable) {
      setQuestionSubmitting(false);
      setQuestionSubmitError('The exchange backend is not active in this environment yet.');
      return;
    }

    const payload = {
      author_user_id: userId,
      author_role: role,
      author_vendor_listing_id: role === 'vendor' ? vendorListing?.id ?? null : null,
      title: questionDraft.title.trim(),
      body: questionDraft.body.trim(),
      category: questionDraft.category,
      urgency: questionDraft.urgency,
      location_county: questionDraft.locationCounty || null,
      is_resolved: false,
      best_answer_id: null,
    };

    const { data, error } = await db
      .from('professional_exchange_questions')
      .insert(payload)
      .select('*')
      .single();

    setQuestionSubmitting(false);

    if (error) {
      setQuestionSubmitError(error.message || 'Could not post your question right now.');
      return;
    }

    const saved = data as ProfessionalExchangeQuestion;
    setQuestions((current) => [saved, ...current]);
    setSelectedQuestionId(saved.id);
    setQuestionDraft(initialQuestionDraft);
    onToast({
      title: 'Question posted',
      description: 'Your planner exchange question is now live for professionals to answer.',
    });
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswerDrafts((current) => ({ ...current, [questionId]: value }));
    setAnswerErrors((current) => ({ ...current, [questionId]: '' }));
  };

  const handleAnswerSubmit = async (question: ProfessionalExchangeQuestion) => {
    const draft = answerDrafts[question.id]?.trim() ?? '';
    if (!draft) {
      setAnswerErrors((current) => ({ ...current, [question.id]: 'Write a useful answer before posting.' }));
      return;
    }

    if (backendUnavailable) {
      setAnswerErrors((current) => ({ ...current, [question.id]: 'The exchange backend is not active in this environment yet.' }));
      return;
    }

    setAnswerSubmittingId(question.id);
    const { data, error } = await db
      .from('professional_exchange_answers')
      .insert({
        question_id: question.id,
        author_user_id: userId,
        author_role: role,
        author_vendor_listing_id: role === 'vendor' ? vendorListing?.id ?? null : null,
        body: draft,
      })
      .select('*')
      .single();

    setAnswerSubmittingId(null);

    if (error) {
      setAnswerErrors((current) => ({ ...current, [question.id]: error.message || 'Could not publish your answer right now.' }));
      return;
    }

    const saved = data as ProfessionalExchangeAnswer;
    setAnswers((current) => [...current, saved]);
    setAnswerDrafts((current) => ({ ...current, [question.id]: '' }));
    onToast({
      title: 'Answer posted',
      description: 'Your response is now helping the network solve real wedding-work problems.',
    });
  };

  const handleMarkBestAnswer = async (question: ProfessionalExchangeQuestion, answerId: string) => {
    setResolveSubmittingId(question.id);
    const { data, error } = await db
      .from('professional_exchange_questions')
      .update({
        best_answer_id: answerId,
        is_resolved: true,
      })
      .eq('id', question.id)
      .select('*')
      .single();

    setResolveSubmittingId(null);

    if (error) {
      onToast({
        title: 'Could not mark best answer',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const saved = data as ProfessionalExchangeQuestion;
    setQuestions((current) => current.map((item) => item.id === saved.id ? saved : item));
    onToast({
      title: 'Best answer selected',
      description: 'That thread now reads as solved and gives the answer more credibility.',
    });
  };

  const handleReopenQuestion = async (question: ProfessionalExchangeQuestion) => {
    setResolveSubmittingId(question.id);
    const { data, error } = await db
      .from('professional_exchange_questions')
      .update({
        best_answer_id: null,
        is_resolved: false,
      })
      .eq('id', question.id)
      .select('*')
      .single();

    setResolveSubmittingId(null);

    if (error) {
      onToast({
        title: 'Could not reopen question',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const saved = data as ProfessionalExchangeQuestion;
    setQuestions((current) => current.map((item) => item.id === saved.id ? saved : item));
    onToast({
      title: 'Question reopened',
      description: 'Professionals can continue helping until the sourcing problem is truly solved.',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-3xl border border-border/60 bg-background/70">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backendUnavailable ? (
        <Card className="semantic-surface-warning shadow-card">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Exchange database rollout still needs activation</p>
              <p className="mt-1 text-foreground/75">
                The professionals exchange interface is ready, but this environment does not have the new Supabase tables yet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-background/70 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Questions</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{exchangeStats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/70 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Open</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{exchangeStats.open}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/70 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Solved</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{exchangeStats.resolved}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/70 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Event-day urgent</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{exchangeStats.urgent}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Ask the network</CardTitle>
              <CardDescription>
                Ask practical wedding-work questions so planners, decorators, and vendors can solve real sourcing and execution problems together.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleAskQuestion}>
                <div className="space-y-2">
                  <Label htmlFor="exchange-title">Question title</Label>
                  <Input
                    id="exchange-title"
                    value={questionDraft.title}
                    onChange={(event) => handleQuestionDraftChange('title', event.target.value)}
                    placeholder="Where can I find 200 gold Chiavari chairs in Naivasha this week?"
                  />
                  <FormFieldError message={questionErrors.title} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={questionDraft.category} onValueChange={(value) => handleQuestionDraftChange('category', value as ProfessionalExchangeCategory)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {professionalExchangeCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {professionalExchangeCategoryMeta[category].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{professionalExchangeCategoryMeta[questionDraft.category].description}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Urgency</Label>
                    <Select value={questionDraft.urgency} onValueChange={(value) => handleQuestionDraftChange('urgency', value as ProfessionalExchangeUrgency)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {professionalExchangeUrgencies.map((urgency) => (
                          <SelectItem key={urgency} value={urgency}>
                            {professionalExchangeUrgencyMeta[urgency].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{professionalExchangeUrgencyMeta[questionDraft.urgency].description}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>County</Label>
                  <Select value={questionDraft.locationCounty || 'all'} onValueChange={(value) => handleQuestionDraftChange('locationCounty', value === 'all' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a county" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">No county preference</SelectItem>
                      {kenyaCounties.map((county) => (
                        <SelectItem key={county} value={county}>{county}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exchange-body">What do you need?</Label>
                  <Textarea
                    id="exchange-body"
                    value={questionDraft.body}
                    onChange={(event) => handleQuestionDraftChange('body', event.target.value)}
                    rows={6}
                    placeholder="Share the event context, guest count, style, county, deadline, and the suppliers or routes you have already tried."
                  />
                  <FormFieldError message={questionErrors.body} />
                </div>

                <FormSubmitError message={questionSubmitError} />
                <Button type="submit" disabled={questionSubmitting} className="w-full gap-2">
                  {questionSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post question
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">What gets the best answers</CardTitle>
              <CardDescription>Keep the exchange practical so it becomes a real industry utility, not noise.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                Mention the county, timing, guest count, and what you already tried.
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                Ask for recommendations, backups, suppliers, or process advice that helps a real wedding move forward.
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                Mark the best answer when the issue is solved so future planners can trust the thread.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-display text-2xl">Planner exchange</CardTitle>
                  <CardDescription>Professionals helping professionals find suppliers, solve logistics, and rescue event-day issues.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topCategories.map((item) => (
                    <Badge key={item.category} variant="outline" className="rounded-full">
                      {professionalExchangeCategoryMeta[item.category].shortLabel} {item.count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={filterCategory} onValueChange={(value) => setFilterCategory(value as 'all' | ProfessionalExchangeCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {professionalExchangeCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {professionalExchangeCategoryMeta[category].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCounty} onValueChange={(value) => setFilterCounty(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All counties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All counties</SelectItem>
                    {kenyaCounties.map((county) => (
                      <SelectItem key={county} value={county}>{county}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | 'open' | 'resolved')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All threads</SelectItem>
                    <SelectItem value="open">Open only</SelectItem>
                    <SelectItem value="resolved">Solved only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-3">
                  {filteredQuestions.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-background/60 p-8 text-center">
                      <h3 className="text-2xl font-semibold text-foreground">No exchange questions yet</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Start the first useful thread. Ask about sourcing, backups, or event-day problem solving.
                      </p>
                    </div>
                  ) : (
                    filteredQuestions.map((question) => {
                      const answerCount = answersByQuestionId[question.id]?.length ?? 0;
                      const isSelected = question.id === selectedQuestion?.id;

                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => setSelectedQuestionId(question.id)}
                          className={cn(
                            'w-full rounded-2xl border p-4 text-left transition-colors',
                            isSelected
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border/60 bg-background/70 hover:border-primary/30',
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={question.is_resolved ? 'success' : 'outline'}>
                              {question.is_resolved ? 'Solved' : 'Open'}
                            </Badge>
                            <Badge variant="outline">
                              {professionalExchangeCategoryMeta[question.category].shortLabel}
                            </Badge>
                            <Badge variant={question.urgency === 'event_day' ? 'destructive' : 'warning'}>
                              {professionalExchangeUrgencyMeta[question.urgency].label}
                            </Badge>
                          </div>
                          <p className="mt-3 font-medium leading-6 text-foreground">{question.title}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MessageSquareText className="h-3.5 w-3.5" />
                              {answerCount} answers
                            </span>
                            {question.location_county ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {question.location_county}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatExchangeTimestamp(question.created_at)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div>
                  {selectedQuestion ? (
                    <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={selectedQuestion.is_resolved ? 'success' : 'outline'}>
                          {selectedQuestion.is_resolved ? 'Solved' : 'Open'}
                        </Badge>
                        <Badge variant="outline">{professionalExchangeCategoryMeta[selectedQuestion.category].label}</Badge>
                        <Badge variant={selectedQuestion.urgency === 'event_day' ? 'destructive' : 'warning'}>
                          {selectedQuestion.urgency === 'event_day' ? <AlertTriangle className="mr-1 h-3.5 w-3.5" /> : null}
                          {professionalExchangeUrgencyMeta[selectedQuestion.urgency].label}
                        </Badge>
                      </div>

                      <h3 className="mt-4 font-display text-3xl text-foreground">{selectedQuestion.title}</h3>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{selectedQuestion.body}</p>

                      {(() => {
                        const author = getAuthorMeta(role, profile, vendorListing, plannerPeers, vendorPeers, selectedQuestion);
                        return (
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              {author.roleLabel === 'Planner' ? <Users className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                              {author.label}
                            </span>
                            <span>{author.roleLabel}</span>
                            {author.trustLabel ? <Badge variant="info">{author.trustLabel}</Badge> : null}
                            {selectedQuestion.location_county ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {selectedQuestion.location_county}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}

                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className="font-medium text-foreground">Answers</h4>
                          {selectedQuestion.is_resolved && canMarkBestAnswer(selectedQuestion) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resolveSubmittingId === selectedQuestion.id}
                              onClick={() => void handleReopenQuestion(selectedQuestion)}
                            >
                              {resolveSubmittingId === selectedQuestion.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Reopen question
                            </Button>
                          ) : null}
                        </div>

                        {(answersByQuestionId[selectedQuestion.id] ?? []).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-5 text-sm text-muted-foreground">
                            No answers yet. The first useful answer can become a real trust signal on Zania.
                          </div>
                        ) : (
                          (answersByQuestionId[selectedQuestion.id] ?? []).map((answer) => {
                            const author = getAuthorMeta(role, profile, vendorListing, plannerPeers, vendorPeers, answer);
                            const isBest = selectedQuestion.best_answer_id === answer.id;
                            return (
                              <div
                                key={answer.id}
                                className={cn(
                                  'rounded-2xl border p-4',
                                  isBest ? 'border-primary/35 bg-primary/5' : 'border-border/60 bg-card/60',
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{author.label}</span>
                                  <Badge variant="outline">{author.roleLabel}</Badge>
                                  {author.trustLabel ? <Badge variant="secondary">{author.trustLabel}</Badge> : null}
                                  {isBest ? (
                                    <Badge variant="default" className="gap-1">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Best answer
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{answer.body}</p>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                  <span className="text-xs text-muted-foreground">{formatExchangeTimestamp(answer.created_at)}</span>
                                  {canMarkBestAnswer(selectedQuestion) && !isBest ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={resolveSubmittingId === selectedQuestion.id}
                                      onClick={() => void handleMarkBestAnswer(selectedQuestion, answer.id)}
                                    >
                                      {resolveSubmittingId === selectedQuestion.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                      Mark best answer
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}

                        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                          <Label htmlFor={`answer-${selectedQuestion.id}`}>Add your answer</Label>
                          <Textarea
                            id={`answer-${selectedQuestion.id}`}
                            className="mt-3"
                            rows={4}
                            value={answerDrafts[selectedQuestion.id] ?? ''}
                            onChange={(event) => handleAnswerChange(selectedQuestion.id, event.target.value)}
                            placeholder="Share a supplier, backup option, process, price range, or execution advice that can genuinely help."
                          />
                          <FormFieldError message={answerErrors[selectedQuestion.id]} />
                          <div className="mt-3 flex justify-end">
                            <Button
                              onClick={() => void handleAnswerSubmit(selectedQuestion)}
                              disabled={answerSubmittingId === selectedQuestion.id}
                              className="gap-2"
                            >
                              {answerSubmittingId === selectedQuestion.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              Post answer
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-background/60 p-8 text-center">
                      <MessageSquareText className="mx-auto h-5 w-5 text-primary/70" />
                      <h3 className="mt-4 font-display text-2xl text-foreground">Pick a question</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Select a thread on the left to read answers or add your own.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
