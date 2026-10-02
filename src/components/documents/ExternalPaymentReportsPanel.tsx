import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  externalInvoicePaymentMethodLabel,
  listOwnerExternalInvoicePayments,
  reviewExternalInvoicePayment,
} from '@/lib/externalInvoicePayments';

export default function ExternalPaymentReportsPanel({ documentId, currency, onConfirmed }: { documentId: string; currency: string; onConfirmed: () => Promise<void> }) {
  const { toast } = useToast();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const query = useQuery({ queryKey:['external-invoice-payments','owner',documentId], queryFn:()=>listOwnerExternalInvoicePayments(documentId) });
  const act = async (id: string, decision: 'confirmed'|'disputed') => {
    setReviewing(id);
    try {
      await reviewExternalInvoicePayment(id,decision,notes[id]?.trim()||null);
      await query.refetch();
      if (decision==='confirmed') await onConfirmed();
      toast({title: decision==='confirmed'?'Payment confirmed':'Payment disputed',description:decision==='confirmed'?'The invoice and linked budget records are updated.':'The couple can now see that this report needs correction.'});
    } catch (error) {
      toast({title:'Could not review payment',description:error instanceof Error?error.message:'Please try again.',variant:'destructive'});
    } finally { setReviewing(null); }
  };
  if (query.isPending) return <p className="text-sm text-muted-foreground">Checking external payment reports…</p>;
  if (query.isError) return <p role="alert" className="text-sm text-destructive">External payment reports could not be loaded.</p>;
  if (!query.data?.length) return null;
  return <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
    <div><h3 className="font-display text-lg">External payment reports</h3><p className="text-sm text-muted-foreground">These are reported by the recipient. Confirm only after checking your M-Pesa, bank or cash records.</p></div>
    {query.data.map(item=><article key={item.id} className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium">{currency} {item.amount.toLocaleString('en-KE')}</p><p className="text-sm text-muted-foreground">{new Date(item.paymentDate).toLocaleDateString('en-KE')} · {externalInvoicePaymentMethodLabel(item.paymentMethod)}</p>{item.reference?<p className="text-xs text-muted-foreground">Reference: {item.reference}</p>:null}</div><span className="text-xs font-semibold uppercase tracking-wide">{item.status}</span></div>
      {item.notes?<p className="mt-3 text-sm">Recipient note: {item.notes}</p>:null}
      {item.reviewNote?<p className="mt-2 text-sm">Review note: {item.reviewNote}</p>:null}
      {item.status==='pending'?<div className="mt-4 space-y-3"><Textarea aria-label={`Review note for ${item.id}`} value={notes[item.id]??''} onChange={event=>setNotes(current=>({...current,[item.id]:event.target.value}))} placeholder="Optional note to the couple" maxLength={500}/><div className="flex flex-wrap gap-2"><Button onClick={()=>void act(item.id,'confirmed')} disabled={reviewing===item.id} className="gap-2">{reviewing===item.id?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}Confirm payment</Button><Button variant="outline" onClick={()=>void act(item.id,'disputed')} disabled={reviewing===item.id} className="gap-2"><X className="h-4 w-4"/>Dispute</Button></div></div>:null}
    </article>)}
  </section>;
}
