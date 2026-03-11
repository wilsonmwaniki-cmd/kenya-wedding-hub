import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Mail, Phone, Globe, ArrowLeft, Loader2, UserCircle, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PlannerData {
  id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  bio: string | null;
  specialties: string[] | null;
}

export default function PlannerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');

  const isCouple = profile?.role === 'couple';

  useEffect(() => {
    if (!id) return;
      const load = async () => {
      const { data, error } = await supabase
        .from('public_planner_profiles')
        .select('id, user_id, full_name, company_name, company_email, company_phone, company_website, bio, specialties, avatar_url')
        .eq('id', id)
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setPlanner(data as PlannerData);
        // Check existing link request
        if (user) {
          const { data: req } = await supabase
            .from('planner_link_requests')
            .select('status')
            .eq('couple_user_id', user.id)
            .eq('planner_user_id', data.user_id)
            .maybeSingle();
          if (req) setRequestStatus(req.status);
        }
      }
      setLoading(false);
    };
    load();
  }, [id, user]);

  const sendRequest = async () => {
    if (!user || !planner) return;
    setSending(true);
    const { data: inserted, error } = await supabase.from('planner_link_requests').insert({
      couple_user_id: user.id,
      planner_user_id: planner.user_id,
      message: message.trim() || null,
    }).select('id').single();
    setSending(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setRequestStatus('pending');
    setDialogOpen(false);
    setMessage('');
    toast({ title: 'Interest sent! ✨', description: 'Your planner will review your request.' });
    // Send email notification with action links (fire-and-forget)
    if (planner.company_email) {
      supabase.functions.invoke('send-connection-notification', {
        body: {
          recipientEmail: planner.company_email,
          recipientName: planner.company_name || planner.full_name,
          requesterName: profile?.full_name || 'A couple',
          message: message.trim() || null,
          type: 'planner',
          requestId: inserted?.id || null,
        },
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !planner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Planner profile not found.</p>
        <Link to="/">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" fill="currentColor" />
          <span className="font-display text-base font-semibold text-foreground">WeddingPlan</span>
          <Link to="/" className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Profile Header */}
        <div className="flex items-start gap-5">
          <Avatar className="h-16 w-16 border-2 border-border shrink-0">
            {planner.avatar_url ? <AvatarImage src={planner.avatar_url} alt="Planner photo" /> : null}
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {planner.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || <UserCircle className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {planner.company_name || planner.full_name || 'Wedding Planner'}
            </h1>
            {planner.company_name && planner.full_name && (
              <p className="text-muted-foreground">{planner.full_name}</p>
            )}
          </div>
        </div>

        {/* Link Request Button for Couples */}
        {isCouple && user && (
          <Card className="shadow-card border-primary/20">
            <CardContent className="flex items-center gap-4 py-4">
              {requestStatus === 'approved' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground">You're linked with this planner</p>
                    <p className="text-sm text-muted-foreground">Your wedding progress is shared.</p>
                  </div>
                </>
              ) : requestStatus === 'pending' ? (
                <>
                  <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground">Interest pending</p>
                    <p className="text-sm text-muted-foreground">Waiting for the planner to accept.</p>
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground">Work with this planner</p>
                    <p className="text-sm text-muted-foreground">Send a connection request to share your wedding progress.</p>
                  </div>
                  <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Interested
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Interest Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">Connect with {planner.company_name || planner.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send a connection request. Once accepted, your wedding progress will be shared with this planner.
              </p>
              <div className="space-y-2">
                <Label>Message (optional)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi! We're planning our wedding and would love your help…"
                  maxLength={500}
                  rows={3}
                />
              </div>
              <Button onClick={sendRequest} disabled={sending} className="w-full gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Send Interest
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Contact Card */}
        {(planner.company_email || planner.company_phone || planner.company_website) && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {planner.company_email && (
                <a href={`mailto:${planner.company_email}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4 text-primary" />
                  {planner.company_email}
                </a>
              )}
              {planner.company_phone && (
                <a href={`tel:${planner.company_phone}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="h-4 w-4 text-primary" />
                  {planner.company_phone}
                </a>
              )}
              {planner.company_website && (
                <a href={planner.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Globe className="h-4 w-4 text-primary" />
                  {planner.company_website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {planner.bio && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{planner.bio}</p>
            </CardContent>
          </Card>
        )}

        {planner.specialties && planner.specialties.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Specialties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {planner.specialties.map(s => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
