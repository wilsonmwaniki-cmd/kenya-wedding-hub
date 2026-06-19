import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Search, CheckCircle2, UserCheck, Users, X, Undo2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { normalizeInvokeError } from '@/lib/invokeErrors';

interface Guest {
  id: string;
  name: string;
  email: string | null;
  rsvp_status: string | null;
  group_name: string | null;
  category: string | null;
  wedding_id: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
}

interface Props {
  guests: Guest[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function GuestCheckIn({ guests, onClose, onUpdate }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [lastAction, setLastAction] = useState<{ id: string; name: string } | null>(null);
  const [pendingGuestId, setPendingGuestId] = useState<string | null>(null);
  const [deviceId] = useState(() => {
    if (typeof window === 'undefined') return 'guest-check-in-device';

    const storageKey = 'zania_guest_check_in_device_id';
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;

    const created = window.crypto?.randomUUID?.() ?? `guest-check-in-${Date.now()}`;
    window.localStorage.setItem(storageKey, created);
    return created;
  });

  const confirmed = guests.filter(g => g.rsvp_status === 'confirmed');
  const checkedIn = guests.filter(g => g.checked_in).length;
  const total = confirmed.length;

  const filtered = search.trim()
    ? guests.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : confirmed;

  const checkIn = async (guest: Guest) => {
    if (pendingGuestId === guest.id) return;
    if (!guest.wedding_id) {
      toast({
        title: 'Wedding workspace missing',
        description: `${guest.name} is not attached to a wedding workspace yet, so check-in cannot start.`,
        variant: 'destructive',
      });
      return;
    }

    setPendingGuestId(guest.id);
    const newStatus = !guest.checked_in;
    const idempotencyKey = window.crypto?.randomUUID?.() ?? `${guest.id}-${Date.now()}`;

    try {
      const { data, error } = await supabase.functions.invoke('guest-check-in', {
        body: {
          guestId: guest.id,
          weddingId: guest.wedding_id,
          action: newStatus ? 'check_in' : 'undo_check_in',
          idempotencyKey,
          deviceId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (newStatus) {
        setLastAction({ id: guest.id, name: guest.name });
        toast({
          title: data?.idempotent ? `${guest.name} is already checked in` : `✓ ${guest.name} checked in`,
        });
      } else {
        setLastAction(null);
        toast({
          title: data?.idempotent ? `${guest.name} was already marked as not checked in` : `${guest.name} check-in undone`,
        });
      }

      onUpdate();
    } catch (error) {
      const normalized = await normalizeInvokeError(
        error,
        `Could not ${newStatus ? 'check in' : 'undo check-in for'} ${guest.name}.`,
      );
      toast({
        title: 'Check-in failed',
        description: normalized.message,
        variant: 'destructive',
      });
    } finally {
      setPendingGuestId(null);
    }
  };

  const undoCheckIn = async () => {
    if (!lastAction) return;
    const guest = guests.find((entry) => entry.id === lastAction.id);
    if (!guest) {
      setLastAction(null);
      return;
    }

    await checkIn({ ...guest, checked_in: true });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg font-bold text-foreground">Guest Check-In</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Stats bar */}
      <div className="bg-card border-b border-border px-4 py-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-foreground font-semibold">{checkedIn} arrived</span>
            <span className="text-muted-foreground">{total - checkedIn} remaining</span>
          </div>
          <span className="text-muted-foreground font-medium">{total} confirmed</span>
        </div>
        <Progress value={total > 0 ? (checkedIn / total) * 100 : 0} />
      </div>

      {/* Search */}
      <div className="px-4 py-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search guest name..."
            className="pl-10"
            autoFocus
          />
        </div>
      </div>

      {/* Undo banner */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 shrink-0"
          >
            <div className="flex items-center justify-between bg-success/10 text-success rounded-lg px-3 py-2 text-sm">
              <span>{lastAction.name} checked in</span>
              <Button variant="ghost" size="sm" className="text-success gap-1 h-7" onClick={undoCheckIn}>
                <Undo2 className="h-3 w-3" /> Undo
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {filtered.map(g => (
          <motion.div
            key={g.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card
              className={`cursor-pointer transition-colors ${g.checked_in ? 'bg-success/5 border-success/20' : 'hover:bg-muted/50'} ${pendingGuestId === g.id ? 'pointer-events-none opacity-70' : ''}`}
              onClick={() => checkIn(g)}
            >
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  g.checked_in ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {pendingGuestId === g.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : g.checked_in ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${g.checked_in ? 'text-success' : 'text-foreground'}`}>{g.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {g.group_name && <span>{g.group_name}</span>}
                    {g.category && g.category !== 'general' && (
                      <span className="bg-muted px-1.5 py-0.5 rounded capitalize">{g.category}</span>
                    )}
                  </div>
                </div>
                {g.checked_in && g.checked_in_at && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(g.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {search ? 'No guests found' : 'No confirmed guests yet'}
          </p>
        )}
      </div>
    </div>
  );
}
