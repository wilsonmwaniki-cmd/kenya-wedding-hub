import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  listAdminZaniaPayLedger,
  reconcileAdminZaniaPayLedger,
  requestAdminZaniaPayRefund,
  type AdminZaniaPayLedgerRow,
} from '@/lib/zaniaPay';

function formatCurrency(value: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function statusVariant(status: string) {
  if (status === 'paid' || status === 'verified') return 'success' as const;
  if (status === 'failed' || status === 'disputed') return 'destructive' as const;
  if (status.includes('refund') || status === 'processing' || status === 'awaiting_authorization') return 'warning' as const;
  return 'secondary' as const;
}

export default function AdminZaniaPayLedger() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminZaniaPayLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [refundRow, setRefundRow] = useState<AdminZaniaPayLedgerRow | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundConfirm, setRefundConfirm] = useState('');
  const [refundKey, setRefundKey] = useState('');
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await listAdminZaniaPayLedger()); }
    catch (error) { toast({ title: 'Could not load payment ledger', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);
  const exceptionCount = useMemo(() => rows.filter((row) => row.exception).length, [rows]);

  const reconcile = async () => {
    setReconciling(true);
    try {
      const result = await reconcileAdminZaniaPayLedger();
      await load();
      const paymentCount = result.paymentChecked ?? 0;
      const refundCount = result.refundChecked ?? 0;
      const checkedItems = [
        paymentCount ? `${paymentCount} payment${paymentCount === 1 ? '' : 's'}` : '',
        refundCount ? `${refundCount} refund${refundCount === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(' and ');
      toast({
        title: 'Reconciliation complete',
        description: checkedItems ? `${checkedItems} checked against Paystack.` : 'No payments or refunds were due for reconciliation.',
      });
    } catch (error) {
      toast({ title: 'Could not reconcile payments', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setReconciling(false); }
  };

  const openRefund = (row: AdminZaniaPayLedgerRow) => {
    setRefundRow(row); setRefundAmount(String(Math.max(0, row.invoiceAmount - row.refundInvoiceAmount))); setRefundReason(''); setRefundConfirm(''); setRefundKey(crypto.randomUUID());
  };

  const submitRefund = async () => {
    if (!refundRow) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0 || refundConfirm.trim().toUpperCase() !== 'REFUND') return;
    setRefunding(true);
    try {
      const result = await requestAdminZaniaPayRefund({ orderId: refundRow.id, invoiceAmount: amount, reason: refundReason, idempotencyKey: refundKey });
      setRefundRow(null); await load();
      toast({ title: 'Refund submitted to Paystack', description: `Refund status: ${result.status}. The ledger will update from Paystack webhooks.` });
    } catch (error) {
      toast({ title: 'Refund was not submitted', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setRefunding(false); }
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Zania Pay payment ledger</CardTitle>
          <CardDescription className="mt-1">Invoice collections, platform fees, professional settlements, refunds, disputes, and recovery exceptions.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={exceptionCount ? 'destructive' : 'success'}>{exceptionCount} exception{exceptionCount === 1 ? '' : 's'}</Badge>
          <Button variant="outline" onClick={() => void reconcile()} disabled={reconciling}>
            {reconciling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Reconcile now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Payment</TableHead><TableHead>Parties</TableHead><TableHead>Charge</TableHead><TableHead>Settlement</TableHead><TableHead>Health</TableHead><TableHead className="text-right">Action</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading payment ledger…</TableCell></TableRow>
              : rows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No Zania Pay transactions yet.</TableCell></TableRow>
              : rows.map((row) => <TableRow key={row.id} className={row.exception ? 'bg-destructive/5' : undefined}>
                <TableCell><div className="font-medium">{row.invoiceNumber}</div><div className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()} · {row.mode}</div><Badge variant={statusVariant(row.status)} className="mt-1 capitalize">{row.status.replaceAll('_', ' ')}</Badge></TableCell>
                <TableCell><div>{row.payerName}</div><div className="text-xs text-muted-foreground">to {row.professionalName}</div></TableCell>
                <TableCell className="text-sm"><div>Total {formatCurrency(row.totalCharged, 'KES')}</div><div className="text-xs text-muted-foreground">Invoice {formatCurrency(row.invoiceAmount, 'KES')} · Provider {formatCurrency(row.providerFee, 'KES')} · Zania {formatCurrency(row.zaniaFee, 'KES')}</div></TableCell>
                <TableCell><div>{formatCurrency(row.professionalSettlement, 'KES')}</div><Badge variant={statusVariant(row.settlementStatus ?? '')} className="mt-1 capitalize">{(row.settlementStatus ?? 'not created').replaceAll('_', ' ')}</Badge>{row.refundAmount > 0 ? <div className="mt-1 text-xs text-muted-foreground">Refunded {formatCurrency(row.refundAmount, 'KES')}</div> : null}</TableCell>
                <TableCell>{row.exception ? <div className="flex max-w-[260px] items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{row.exception}</div> : <Badge variant="success">Healthy</Badge>}<div className="mt-1 text-xs text-muted-foreground">Reconciled: {row.reconciliationStatus}</div>{row.disputeStatus ? <Badge variant="destructive" className="mt-1 capitalize">Dispute {row.disputeStatus}</Badge> : null}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openRefund(row)} disabled={!['paid', 'part_refunded'].includes(row.status) || row.invoiceAmount - row.refundInvoiceAmount <= 0}><RotateCcw className="mr-2 h-4 w-4" />Refund</Button></TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={Boolean(refundRow)} onOpenChange={(open) => { if (!open && !refunding) setRefundRow(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund {refundRow?.invoiceNumber}</DialogTitle><DialogDescription>This sends a real provider refund in the payment’s own environment. Full invoice refunds also return the KES 50 Zania fee; provider processing fees are not automatically returned.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="refund-amount">Invoice amount to refund</Label><Input id="refund-amount" inputMode="decimal" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value.replace(/[^0-9.]/g, ''))} /></div>
            <div className="space-y-2"><Label htmlFor="refund-reason">Reason</Label><Textarea id="refund-reason" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Why is this payment being refunded?" /></div>
            <div className="space-y-2"><Label htmlFor="refund-confirm">Type REFUND to confirm</Label><Input id="refund-confirm" value={refundConfirm} onChange={(event) => setRefundConfirm(event.target.value)} autoComplete="off" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRefundRow(null)} disabled={refunding}>Cancel</Button><Button variant="destructive" onClick={() => void submitRefund()} disabled={refunding || refundConfirm.trim().toUpperCase() !== 'REFUND'}>{refunding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}Submit refund</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
