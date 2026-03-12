import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Plus, Copy, ExternalLink, ShieldCheck, CreditCard, LockKeyhole, AlertTriangle, UserCog, Phone } from 'lucide-react';
import AvatarUpload from '@/components/AvatarUpload';
import { isCommitteePlanner, plannerAccessMessage, plannerHasActiveSubscription, plannerHasFullAccess } from '@/lib/plannerAccess';

type CommitteeMember = Tables<'wedding_committee_members'>;

const committeePermissionOptions = ['chair', 'member', 'viewer'] as const;
const committeeResponsibilityOptions = [
  'Photography',
  'Catering',
  'Decor',
  'Venue',
  'Transport',
  'Entertainment',
  'Guest Coordination',
  'Finance',
  'Protocol / MC',
  'Bridal Logistics',
];

export default function ProfileSettings() {
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [committeeLoading, setCommitteeLoading] = useState(false);
  const [savingCommitteeMember, setSavingCommitteeMember] = useState(false);
  const [deletingCommitteeMemberId, setDeletingCommitteeMemberId] = useState<string | null>(null);
  const [committeeMemberForm, setCommitteeMemberForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    responsibility: committeeResponsibilityOptions[0],
    permission_level: 'member' as CommitteeMember['permission_level'],
  });

  const isPlanner = profile?.role === 'planner';
  const isVendor = profile?.role === 'vendor';
  const isAdmin = profile?.role === 'admin';
  const isCommittee = isCommitteePlanner(profile);
  const isProfessionalPlanner = isPlanner && !isCommittee;

  const [form, setForm] = useState({
    full_name: '',
    partner_name: '',
    wedding_date: '',
    wedding_location: '',
    company_name: '',
    company_email: '',
    company_phone: '',
    company_website: '',
    bio: '',
    specialties: [] as string[],
    committee_name: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        partner_name: profile.partner_name || '',
        wedding_date: profile.wedding_date || '',
        wedding_location: profile.wedding_location || '',
        company_name: profile.company_name || '',
        company_email: profile.company_email || '',
        company_phone: profile.company_phone || '',
        company_website: profile.company_website || '',
        bio: profile.bio || '',
        specialties: profile.specialties || [],
        committee_name: profile.committee_name || '',
      });
    }
  }, [profile]);

  const loadCommitteeMembers = async () => {
    if (!profile?.user_id || !isCommittee) {
      setCommitteeMembers([]);
      return;
    }
    setCommitteeLoading(true);
    try {
      const { data, error } = await supabase
        .from('wedding_committee_members')
        .select('*')
        .eq('chair_user_id', profile.user_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setCommitteeMembers((data ?? []) as CommitteeMember[]);
    } catch (err: any) {
      toast({ title: 'Failed to load committee members', description: err.message, variant: 'destructive' });
    } finally {
      setCommitteeLoading(false);
    }
  };

  useEffect(() => {
    void loadCommitteeMembers();
  }, [profile?.user_id, isCommittee]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Record<string, any> = { full_name: form.full_name };
      if (isProfessionalPlanner) {
        updates.company_name = form.company_name;
        updates.company_email = form.company_email;
        updates.company_phone = form.company_phone;
        updates.company_website = form.company_website;
        updates.bio = form.bio;
        updates.specialties = form.specialties;
      } else if (isCommittee) {
        updates.committee_name = form.committee_name;
      } else if (!isVendor && !isAdmin) {
        updates.partner_name = form.partner_name;
        updates.wedding_date = form.wedding_date;
        updates.wedding_location = form.wedding_location;
      }
      await updateProfile(updates);
      toast({ title: 'Profile updated!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addSpecialty = () => {
    const trimmed = newSpecialty.trim();
    if (trimmed && !form.specialties.includes(trimmed)) {
      setForm(f => ({ ...f, specialties: [...f.specialties, trimmed] }));
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (s: string) => {
    setForm(f => ({ ...f, specialties: f.specialties.filter(x => x !== s) }));
  };

  const profileUrl = profile ? `${window.location.origin}/planner/${profile.id}` : '';

  const copyProfileLink = () => {
    navigator.clipboard.writeText(profileUrl);
    toast({ title: 'Link copied!', description: 'Share this link with potential clients.' });
  };

  const handleRequestPlannerVerification = async () => {
    setRequestingVerification(true);
    try {
      const { error } = await supabase.rpc('request_planner_verification' as any);
      if (error) throw error;
      toast({ title: 'Verification requested', description: 'Your planner verification request has been sent to admin.' });
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Verification request failed', description: err.message, variant: 'destructive' });
    } finally {
      setRequestingVerification(false);
    }
  };

  const plannerSubscriptionActive = plannerHasActiveSubscription(profile);
  const plannerFullAccess = plannerHasFullAccess(profile);

  const addCommitteeMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.user_id) return;
    setSavingCommitteeMember(true);
    try {
      const { error } = await supabase.from('wedding_committee_members').insert({
        chair_user_id: profile.user_id,
        full_name: committeeMemberForm.full_name,
        phone: committeeMemberForm.phone,
        email: committeeMemberForm.email || null,
        responsibility: committeeMemberForm.responsibility,
        permission_level: committeeMemberForm.permission_level,
      });
      if (error) throw error;
      setCommitteeMemberForm({
        full_name: '',
        phone: '',
        email: '',
        responsibility: committeeResponsibilityOptions[0],
        permission_level: 'member',
      });
      await loadCommitteeMembers();
      toast({ title: 'Committee member added' });
    } catch (err: any) {
      toast({ title: 'Failed to add committee member', description: err.message, variant: 'destructive' });
    } finally {
      setSavingCommitteeMember(false);
    }
  };

  const removeCommitteeMember = async (memberId: string) => {
    setDeletingCommitteeMemberId(memberId);
    try {
      const { error } = await supabase.from('wedding_committee_members').delete().eq('id', memberId);
      if (error) throw error;
      await loadCommitteeMembers();
      toast({ title: 'Committee member removed' });
    } catch (err: any) {
      toast({ title: 'Failed to remove committee member', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingCommitteeMemberId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          {isProfessionalPlanner
            ? 'Manage your planner profile & company details'
            : isCommittee
              ? 'Manage your committee profile, members, and access'
              : isVendor
                ? 'Manage your account settings'
                : isAdmin
                  ? 'Manage your owner profile'
                  : 'Manage your wedding profile'}
        </p>
      </div>

      {isPlanner && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <ExternalLink className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{isCommittee ? 'Workspace Link' : 'Public Profile'}</p>
              <p className="text-xs text-muted-foreground truncate">{isCommittee ? 'Committee accounts are not listed publicly. This link is private to your workspace.' : profileUrl}</p>
            </div>
            {!isCommittee && (
              <Button type="button" variant="outline" size="sm" onClick={copyProfileLink}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isPlanner && profile && (
        <Card className={plannerFullAccess ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-muted/20'}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {plannerFullAccess ? <ShieldCheck className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-5 w-5 text-primary" />}
              Planner Access
            </CardTitle>
            <CardDescription>
              Full planner access unlocks only after active subscription and verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={plannerSubscriptionActive ? 'secondary' : 'outline'}>
                <CreditCard className="mr-1 h-3 w-3" />
                {profile.planner_subscription_status}
              </Badge>
              <Badge variant={profile.planner_verified ? 'secondary' : 'outline'}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {profile.planner_verified ? 'Verified' : profile.planner_verification_requested ? 'Verification requested' : 'Unverified'}
              </Badge>
            </div>

            <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Current access status</p>
              <p className="mt-1">{plannerAccessMessage(profile)}</p>
              {isCommittee && profile.committee_name && (
                <p className="mt-1 text-xs">Committee: {profile.committee_name}</p>
              )}
              {profile.planner_subscription_expires_at && (
                <p className="mt-1 text-xs">
                  Subscription expiry: {new Date(profile.planner_subscription_expires_at).toLocaleDateString()}
                </p>
              )}
              {profile.planner_verification_requested_at && !profile.planner_verified && (
                <p className="mt-1 text-xs">
                  Verification requested on {new Date(profile.planner_verification_requested_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleRequestPlannerVerification}
                disabled={!plannerSubscriptionActive || profile.planner_verified || profile.planner_verification_requested || requestingVerification}
              >
                {requestingVerification ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {profile.planner_verified ? 'Already Verified' : profile.planner_verification_requested ? 'Verification Requested' : 'Request Verification'}
              </Button>
              {!plannerSubscriptionActive && (
                <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  {isCommittee ? 'Committee subscription must be activated by admin before verification can be requested.' : 'Subscription must be activated by admin before verification can be requested.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Details */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Personal Details</CardTitle>
            <CardDescription>Your name and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPlanner && (
              <div className="space-y-2">
                <Label>Profile Photo / Logo</Label>
                <AvatarUpload />
              </div>
            )}
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {isProfessionalPlanner ? (
          <>
            {/* Company Details */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">Company Details</CardTitle>
                <CardDescription>Your wedding planning business information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Dream Weddings Kenya" />
                </div>
                <div className="space-y-2">
                  <Label>Business Email</Label>
                  <Input type="email" value={form.company_email} onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))} placeholder="info@yourcompany.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Phone</Label>
                    <Input value={form.company_phone} onChange={e => setForm(f => ({ ...f, company_phone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={form.company_website} onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))} placeholder="https://yourcompany.com" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bio & Specialties */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">About You</CardTitle>
                <CardDescription>Tell clients about your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Textarea
                    value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    placeholder="Share your experience, approach, and what makes your service special..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Specialties</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newSpecialty}
                      onChange={e => setNewSpecialty(e.target.value)}
                      placeholder="e.g. Destination Weddings"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addSpecialty}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {form.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.specialties.map(s => (
                        <Badge key={s} variant="secondary" className="gap-1 pr-1">
                          {s}
                          <button type="button" onClick={() => removeSpecialty(s)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : isCommittee ? (
          <>
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">Committee Details</CardTitle>
                <CardDescription>Set the committee name used across this wedding workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Committee Name</Label>
                  <Input
                    value={form.committee_name}
                    onChange={e => setForm(f => ({ ...f, committee_name: e.target.value }))}
                    placeholder="e.g. Mary & James Wedding Committee"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-primary" />
                  Committee Members
                </CardTitle>
                <CardDescription>
                  Add members, assign wedding responsibilities, and store the phone numbers attached to each role.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={addCommitteeMember} className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={committeeMemberForm.full_name}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Committee member name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={committeeMemberForm.phone}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+254..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (optional)</Label>
                    <Input
                      type="email"
                      value={committeeMemberForm.email}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="member@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsibility</Label>
                    <select
                      value={committeeMemberForm.responsibility}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, responsibility: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {committeeResponsibilityOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Permission</Label>
                    <select
                      value={committeeMemberForm.permission_level}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, permission_level: e.target.value as CommitteeMember['permission_level'] }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {committeePermissionOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={savingCommitteeMember}>
                      {savingCommitteeMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Add Committee Member
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  {committeeLoading && <p className="text-sm text-muted-foreground">Loading committee members...</p>}
                  {!committeeLoading && committeeMembers.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                      No committee members added yet.
                    </div>
                  )}
                  {committeeMembers.map((member) => (
                    <div key={member.id} className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-background px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {member.phone}</span>
                          {member.email && <span>{member.email}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{member.responsibility}</Badge>
                          <Badge variant="secondary">{member.permission_level}</Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCommitteeMember(member.id)}
                        disabled={deletingCommitteeMemberId === member.id}
                      >
                        {deletingCommitteeMemberId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : !isVendor && !isAdmin ? (
          /* Couple: Wedding Details */
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display">Wedding Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Partner's Name</Label>
                <Input value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} placeholder="Partner's name" />
              </div>
              <div className="space-y-2">
                <Label>Wedding Date</Label>
                <Input type="date" value={form.wedding_date} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Wedding Location</Label>
                <Input value={form.wedding_location} onChange={e => setForm(f => ({ ...f, wedding_location: e.target.value }))} placeholder="e.g. Nairobi, Mombasa, Naivasha" />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
