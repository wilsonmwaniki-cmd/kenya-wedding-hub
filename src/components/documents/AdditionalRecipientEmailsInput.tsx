import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normaliseAdditionalRecipientEmails } from '@/lib/commercialDocuments';

type Props = {
  idPrefix: string;
  primaryEmail: string;
  value: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  contractCopy?: boolean;
};

export default function AdditionalRecipientEmailsInput({
  idPrefix,
  primaryEmail,
  value,
  onChange,
  disabled = false,
  contractCopy = false,
}: Props) {
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addRecipients = () => {
    const candidates = pendingEmail.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean);
    const next = normaliseAdditionalRecipientEmails([...value, ...candidates], primaryEmail);
    if (!candidates.length) return;
    if (next.length === value.length) {
      setError('Enter a new, valid email address.');
      return;
    }
    onChange(next);
    setPendingEmail('');
    setError(null);
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={`${idPrefix}-additional-emails`}>Additional recipients</Label>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-additional-emails`}
          type="email"
          inputMode="email"
          value={pendingEmail}
          disabled={disabled}
          placeholder="another@example.com"
          onChange={(event) => { setPendingEmail(event.target.value); setError(null); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addRecipients();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={addRecipients} disabled={disabled || !pendingEmail.trim()} aria-label="Add recipient email">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {contractCopy
          ? 'These contacts receive a review copy. Only the main client email can sign the agreement.'
          : 'These contacts receive the document whenever you send or resend it.'}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Additional recipients">
          {value.map((email) => (
            <li key={email} className="flex items-center gap-1 rounded-full border border-border bg-muted/30 py-1 pl-3 pr-1 text-xs text-foreground">
              <span>{email}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-full" disabled={disabled} onClick={() => onChange(value.filter((entry) => entry !== email))} aria-label={`Remove ${email}`}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
