import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  listAdminZaniaPayAccounts,
  refreshAdminZaniaPayAccount,
  type AdminZaniaPayAccount,
} from '@/lib/zaniaPay';

function dateTimeLabel(value?: string) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not yet' : date.toLocaleString();
}

function statusVariant(status: AdminZaniaPayAccount['status']) {
  if (status === 'verified') return 'success' as const;
  if (status === 'rejected') return 'destructive' as const;
  if (status === 'pending') return 'warning' as const;
  return 'secondary' as const;
}

export default function AdminZaniaPayQueue() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AdminZaniaPayAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await listAdminZaniaPayAccounts());
    } catch (error) {
      toast({
        title: 'Could not load payout accounts',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const refreshAccount = async (accountId: string) => {
    setRefreshingId(accountId);
    try {
      const updated = await refreshAdminZaniaPayAccount(accountId);
      setAccounts((current) => current.map((account) => account.id === accountId ? updated : account));
      toast({
        title: updated.status === 'verified' ? 'Payout account verified' : 'Status refreshed',
        description: updated.status === 'verified'
          ? `${updated.professionalName} can receive eligible Zania Pay invoices.`
          : 'No payment access was enabled. Verify the destination in Paystack before refreshing again.',
      });
    } catch (error) {
      toast({
        title: 'Could not refresh payout account',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Zania Pay payout accounts</CardTitle>
          <CardDescription className="mt-1 max-w-3xl">
            Review masked professional destinations here. Verification happens in the Paystack Dashboard; Zania only enables invoice payments after Paystack reports the account as verified.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => void loadAccounts()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
          Refresh queue
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>Full payout numbers and Paystack account references are never shown in this queue. There is no manual override for provider verification.</p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Professional</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last provider sync</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading payout accounts…</TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No payout accounts have been submitted.</TableCell>
              </TableRow>
            ) : accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{account.professionalName}</div>
                  <div className="text-xs capitalize text-muted-foreground">{account.audience || 'professional'}</div>
                </TableCell>
                <TableCell>{account.settlementDestinationHint || 'Not provided'}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{account.mode || 'sandbox'}</Badge></TableCell>
                <TableCell>
                  <Badge variant={statusVariant(account.status)} className="capitalize">{account.status.replace('_', ' ')}</Badge>
                  {account.rejectionReason ? <p className="mt-1 max-w-xs text-xs text-destructive">{account.rejectionReason}</p> : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{dateTimeLabel(account.lastProviderSyncAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refreshAccount(account.id)}
                    disabled={refreshingId === account.id}
                    aria-label={`Refresh Paystack status for ${account.professionalName}`}
                  >
                    {refreshingId === account.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
                    Refresh Paystack
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
