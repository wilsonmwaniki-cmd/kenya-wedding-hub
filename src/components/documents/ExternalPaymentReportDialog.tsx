import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { SharedCommercialDocument } from '@/lib/commercialDocuments';
import {
  externalInvoicePaymentMethodLabel,
  listRecipientExternalInvoicePayments,
  submitExternalInvoicePayment,
  type ExternalInvoicePaymentReport,
} from '@/lib/externalInvoicePayments';

const today = () => new Date().toISOString().slice(0,10);

export default function ExternalPaymentReportDialog({ document, shareToken, onChanged }: { document: SharedCommercialDocument; shareToken: string; onChanged?: () => Promise<void> }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open,setOpen]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [amount,setAmount]=useState(String(document.balanceDue));
  const [date,setDate]=useState(today());
  const [method,setMethod]=useState<ExternalInvoicePaymentReport['paymentMethod']>('mpesa');
  const [reference,setReference]=useState('');
  const [notes,setNotes]=useState('');
  const reports=useQuery({queryKey:['external-invoice-payments','recipient',shareToken],queryFn:()=>listRecipientExternalInvoicePayments(shareToken),enabled:open});
  const submit=async(event: FormEvent)=>{
    event.preventDefault();
    const value=Number(amount.replace(/,/g,''));
    if(!Number.isFinite(value)||value<=0||value>document.balanceDue){toast({title:'Check the amount',description:`Enter an amount up to ${document.currency} ${document.balanceDue.toLocaleString('en-KE')}.`,variant:'destructive'});return;}
    setSubmitting(true);
    try{
      await submitExternalInvoicePayment({shareToken,requestId:crypto.randomUUID(),amount:value,paymentDate:date,paymentMethod:method,reference:reference.trim()||null,notes:notes.trim()||null});
      await reports.refetch();
      await onChanged?.();
      setReference('');setNotes('');
      setOpen(false);
      toast({title:'Payment reported',description:'The professional has been asked to confirm it. The invoice will update only after confirmation.'});
      navigate('/received-documents', { replace: true });
    }catch(error){toast({title:'Could not report payment',description:error instanceof Error?error.message:'Please try again.',variant:'destructive'});}finally{setSubmitting(false);}
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline">Record an external payment</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Record payment made outside Zania</DialogTitle><DialogDescription>Report money you already sent directly to {document.issuerName}. This does not move money or charge a Zania fee. The invoice updates after the professional confirms it.</DialogDescription></DialogHeader>
    <div className="rounded-xl border bg-muted/20 p-3 text-sm"><p className="font-medium">{document.documentNumber} · {document.title}</p><p className="text-muted-foreground">Outstanding: {document.currency} {document.balanceDue.toLocaleString('en-KE')}</p></div>
    <form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="external-payment-amount">Amount paid</Label><Input id="external-payment-amount" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value.replace(/[^0-9.,]/g,''))} required/></div><div className="space-y-2"><Label htmlFor="external-payment-date">Payment date</Label><Input id="external-payment-date" type="date" max={today()} value={date} onChange={event=>setDate(event.target.value)} required/></div><div className="space-y-2"><Label htmlFor="external-payment-method">Payment method</Label><select id="external-payment-method" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={method} onChange={event=>setMethod(event.target.value as ExternalInvoicePaymentReport['paymentMethod'])}>{(['mpesa','bank','cash','card','other'] as const).map(value=><option key={value} value={value}>{externalInvoicePaymentMethodLabel(value)}</option>)}</select></div><div className="space-y-2"><Label htmlFor="external-payment-reference">Transaction reference</Label><Input id="external-payment-reference" value={reference} maxLength={120} onChange={event=>setReference(event.target.value)} placeholder="M-Pesa code or bank reference"/><p className="text-xs text-muted-foreground">Recommended for M-Pesa, bank and card payments so the professional can match the transaction.</p></div><div className="space-y-2"><Label htmlFor="external-payment-notes">Notes (optional)</Label><Textarea id="external-payment-notes" value={notes} maxLength={1000} onChange={event=>setNotes(event.target.value)} placeholder="Anything that will help identify the payment"/></div><Button type="submit" disabled={submitting} className="w-full">{submitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}Submit for confirmation</Button></form>
    {reports.isError?<p role="alert" className="text-sm text-destructive">Previous payment reports could not be loaded. You can still submit this report.</p>:null}
    {reports.data?.length?<section className="space-y-2 border-t pt-4"><h3 className="font-medium">Reports for this invoice</h3>{reports.data.map(item=><div key={item.id} className="rounded-xl border p-3 text-sm"><div className="flex justify-between gap-3"><span>{document.currency} {item.amount.toLocaleString('en-KE')} · {new Date(item.paymentDate).toLocaleDateString('en-KE')}</span><span className="font-semibold capitalize">{item.status}</span></div>{item.reviewNote?<p className="mt-2 text-muted-foreground">Professional note: {item.reviewNote}</p>:null}{item.status==='pending'?<p className="mt-2 text-muted-foreground">Awaiting professional confirmation. It is not yet counted as paid.</p>:null}</div>)}</section>:null}
  </DialogContent></Dialog>;
}
