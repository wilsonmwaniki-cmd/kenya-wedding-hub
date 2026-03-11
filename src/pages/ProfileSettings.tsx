import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Plus, Copy, ExternalLink, ShieldCheck, CreditCard, LockKeyhole, AlertTriangle } from 'lucide-react';
import AvatarUpload from '@/components/AvatarUpload';
import { plannerAccessMessage, plannerHasActiveSubscription, plannerHasFullAccess } from '@/lib/plannerAccess';

export default function ProfileSettings() {
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [requestingVerification, setRequestingVerification] = useState(false);

  const isPlanner = profile?.role === 'planner';
  const isVendor = profile?.role === 'vendor';
  const isAdmin = profile?.role === 'admin';

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
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Record<string, any> = { full_name: form.full_name };
      if (isPlanner) {
        updates.company_name = form.company_name;
        updates.company_email = form.company_email;
        updates.company_phone = form.company_phone;
        updates.company_website = form.company_website;
        updates.bio = form.bio;
        updates.specialties = form.specialties;
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

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          {isPlanner ? 'Manage your planner profile & company details' : isVendor ? 'Manage your account settings' : isAdmin ? 'Manage your owner profile' : 'Manage your wedding profile'}
        </p>
      </div>

      {isPlanner && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <ExternalLink className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Public Profile</p>
              <p className="text-xs text-muted-foreground truncate">{profileUrl}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={copyProfileLink}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
            </Button>
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
                  Subscription must be activated by admin before verification can be requested.
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

        {isPlanner ? (
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
