import { useEffect, useMemo, useState } from 'react';
import { BookUser, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { listProfessionalContacts, type ProfessionalContact } from '@/lib/professionalContacts';

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (contact: ProfessionalContact) => void;
  disabled?: boolean;
};

export default function ContactRecipientPicker({ id, value, onChange, onSelect, disabled = false }: Props) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ProfessionalContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    listProfessionalContacts(user.id)
      .then((result) => { if (!cancelled) setContacts(result); })
      .catch((error) => console.error('Could not load contacts for document recipient:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return contacts.slice(0, 5);
    return contacts.filter((contact) => [contact.displayName, contact.primaryEmail, contact.organisationName]
      .some((entry) => entry?.toLowerCase().includes(query))).slice(0, 5);
  }, [contacts, value]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onChange={(event) => onChange(event.target.value)}
      />
      {focused && (loading || suggestions.length > 0) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-xs text-muted-foreground">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookUser className="h-3.5 w-3.5" />}
            {loading ? 'Loading contacts…' : 'Saved contacts'}
          </div>
          {!loading && suggestions.map((contact) => (
            <button
              key={contact.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onSelect(contact); setFocused(false); }}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{contact.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">{contact.primaryEmail ?? contact.phone ?? 'No contact details'}</span>
              </span>
              <span className="shrink-0 text-xs capitalize text-muted-foreground">{contact.contactType}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
