import { FormEvent, useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  createProfessionalReviewInvite,
  listProfessionalReviewInvites,
  revokeProfessionalReviewInvite,
  type ProfessionalReviewInvite,
} from '@/lib/professionalReviews';

function inviteStatus(invite: ProfessionalReviewInvite) {
  if (invite.status === 'sent' && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { label: 'Expired', variant: 'outline' as const };
  }
  if (invite.status === 'completed') return { label: 'Reviewed', variant: 'default' as const };
  if (invite.status === 'revoked') return { label: 'Revoked', variant: 'secondary' as const };
  return { label: 'Awaiting review', variant: 'outline' as const };
}

export default function ReviewInvitations() {
  const { toast } = useToast();
  const [coupleName, setCoupleName] = useState('');
  const [coupleEmail, setCoupleEmail] = useState('');
  const [invites, setInvites] = useState<ProfessionalReviewInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ProfessionalReviewInvite | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadInvites = useCallback(async () => {
    try {
      setInvites(await listProfessionalReviewInvites());
    } catch (error) {
      toast({
        title: 'Could not load review invitations',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createProfessionalReviewInvite({
        coupleName: coupleName.trim(),
        coupleEmail: coupleEmail.trim().toLowerCase(),
      });
      setCoupleName('');
      setCoupleEmail('');
      setInviteOpen(false);
      await loadInvites();
      toast({
        title: 'Review invitation sent',
      });
    } catch (error) {
      toast({
        title: 'Could not send invitation',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      await revokeProfessionalReviewInvite(inviteId);
      setInvites((current) => current.map((invite) => (
        invite.id === inviteId ? { ...invite, status: 'revoked' } : invite
      )));
      toast({ title: 'Invitation revoked' });
    } catch (error) {
      toast({
        title: 'Could not revoke invitation',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-semibold text-foreground">Reviews</h1>
        <Button onClick={() => setInviteOpen(true)}>Invite couple</Button>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite couple</DialogTitle>
            <DialogDescription>Send a private review link.</DialogDescription>
          </DialogHeader>
            <form className="space-y-4" onSubmit={submitInvite}>
              <div className="space-y-2">
                <Label htmlFor="review-couple-name">Couple’s name *</Label>
                <Input
                  id="review-couple-name"
                  value={coupleName}
                  onChange={(event) => setCoupleName(event.target.value)}
                  placeholder="e.g. Amina & Kamau"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-couple-email">Email address *</Label>
                <Input
                  id="review-couple-email"
                  type="email"
                  value={coupleEmail}
                  onChange={(event) => setCoupleEmail(event.target.value)}
                  placeholder="couple@example.com"
                  maxLength={320}
                  required
                />
              </div>
              <details className="rounded-xl border border-border/70">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground marker:content-none">Link details</summary>
                <p className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">The link expires after 30 days, works once and does not show the couple’s email publicly.</p>
              </details>
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send invite
              </Button>
            </form>
        </DialogContent>
      </Dialog>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-xl">Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Opening invitations…
              </div>
            ) : invites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No invitations yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invites.map((invite) => {
                  const status = inviteStatus(invite);
                  const canRevoke = status.label === 'Awaiting review';
                  return (
                    <div key={invite.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">{invite.couple_name}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{invite.couple_email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Sent {format(new Date(invite.created_at), 'd MMM yyyy')} · Expires {format(new Date(invite.expires_at), 'd MMM yyyy')}
                        </p>
                      </div>
                      {canRevoke ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-2 self-start sm:self-auto"
                          onClick={() => setRevokeTarget(invite)}
                          disabled={revokingId === invite.id}
                        >
                          {revokingId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          Revoke link
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke review link?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.couple_name} will no longer be able to use this link. You can send a new invite later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep link</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeTarget) void revokeInvite(revokeTarget.id);
                setRevokeTarget(null);
              }}
            >
              Revoke link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
