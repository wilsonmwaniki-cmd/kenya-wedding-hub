import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Check, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { plannerHasFullAccess } from '@/lib/plannerAccess';

interface VendorInterestButtonProps {
  vendorListingId: string;
  vendorName: string;
  vendorEmail?: string | null;
  /** Pre-loaded status for this vendor (null = no request yet) */
  existingStatus?: string | null;
  onStatusChange?: () => void;
  size?: 'sm' | 'default';
}

export default function VendorInterestButton({
  vendorListingId,
  vendorName,
  vendorEmail,
  existingStatus = null,
  onStatusChange,
  size = 'sm',
}: VendorInterestButtonProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<string | null>(existingStatus);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Only couples and planners can send interest
  if (!user || !profile || profile.role === 'vendor') return null;
  if (profile.role === 'planner' && !plannerHasFullAccess(profile as any)) return null;

  const handleSendInterest = async () => {
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from('vendor_connection_requests' as any).insert({
      requester_user_id: user.id,
      vendor_listing_id: vendorListingId,
      message: message.trim() || null,
    } as any).select('id').single();

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already sent', description: 'You already sent interest to this vendor.' });
        setStatus('pending');
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      setStatus('pending');
      toast({ title: 'Interest sent! ✨', description: `${vendorName} will review your request.` });
      onStatusChange?.();
      // Send email notification with action links (fire-and-forget)
      if (vendorEmail) {
        supabase.functions.invoke('send-connection-notification', {
          body: {
            recipientEmail: vendorEmail,
            recipientName: vendorName,
            requesterName: profile?.full_name || 'A couple',
            message: message.trim() || null,
            type: 'vendor',
            requestId: (inserted as any)?.id || null,
          },
        }).catch(() => {});
      }
    }
    setSubmitting(false);
    setDialogOpen(false);
    setMessage('');
  };

  if (status === 'accepted') {
    return (
      <Button variant="outline" size={size} disabled className="gap-1.5 text-primary border-primary/30">
        <Check className="h-3.5 w-3.5" /> Connected
      </Button>
    );
  }

  if (status === 'pending') {
    return (
      <Button variant="outline" size={size} disabled className="gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Pending
      </Button>
    );
  }

  if (status === 'declined') {
    return (
      <Button variant="outline" size={size} disabled className="gap-1.5 text-muted-foreground">
        Declined
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
        className="gap-1.5 hover:border-primary hover:text-primary transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" /> Interested
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Connect with {vendorName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a connection request. Once accepted, you'll be connected and can share details.
            </p>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! We're planning our wedding and love your work…"
                maxLength={500}
                rows={3}
              />
            </div>
            <Button onClick={handleSendInterest} disabled={submitting} className="w-full gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Send Interest
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
