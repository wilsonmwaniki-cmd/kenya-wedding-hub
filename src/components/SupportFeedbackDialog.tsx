import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ImagePlus,
  Lightbulb,
  Loader2,
  ReceiptText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SupportCategory = 'bug' | 'confusing' | 'suggestion' | 'billing';

type SupportFeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceLabel?: string | null;
  weddingId?: string | null;
  plannerClientId?: string | null;
  errorReference?: string | null;
  initialCategory?: SupportCategory;
};

const categoryOptions: Array<{
  value: SupportCategory;
  label: string;
  description: string;
  icon: typeof AlertCircle;
}> = [
  { value: 'bug', label: 'Something is not working', description: 'A page, button, or action failed.', icon: AlertCircle },
  { value: 'confusing', label: 'I am confused', description: 'Something is difficult to understand.', icon: HelpCircle },
  { value: 'suggestion', label: 'I have a suggestion', description: 'An idea that could improve Zania.', icon: Lightbulb },
  { value: 'billing', label: 'Billing or account help', description: 'Payments, plans, access, or account details.', icon: ReceiptText },
];

const maxScreenshotBytes = 4 * 1024 * 1024;
const allowedScreenshotTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('We could not read that screenshot.'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'We could not send your message. Please try again.';
}

export default function SupportFeedbackDialog({
  open,
  onOpenChange,
  workspaceLabel,
  weddingId,
  plannerClientId,
  errorReference,
  initialCategory = 'bug',
}: SupportFeedbackDialogProps) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] = useState<SupportCategory>(initialCategory);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
    setError(null);
    setReference(null);
    if (errorReference) {
      setMessage('Please help me with the problem shown on this page.');
    }
  }, [errorReference, initialCategory, open]);

  const resetAndClose = () => {
    onOpenChange(false);
    window.setTimeout(() => {
      setMessage('');
      setScreenshot(null);
      setError(null);
      setReference(null);
    }, 200);
  };

  const handleScreenshot = (file: File | null) => {
    setError(null);
    if (!file) {
      setScreenshot(null);
      return;
    }
    if (!allowedScreenshotTypes.has(file.type)) {
      setError('Attach a JPG, PNG, or WebP screenshot.');
      return;
    }
    if (file.size > maxScreenshotBytes) {
      setError('Screenshots must be smaller than 4 MB.');
      return;
    }
    setScreenshot(file);
  };

  const handleSubmit = async () => {
    const cleanedMessage = message.trim();
    if (cleanedMessage.length < 5) {
      setError('Add a short message so we know how to help.');
      return;
    }
    if (!user) {
      setError('Please sign in again, or email hello@planwithzania.com.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const screenshotPayload = screenshot
        ? {
            name: screenshot.name,
            type: screenshot.type,
            size: screenshot.size,
            content: await fileToBase64(screenshot),
          }
        : null;

      const { data, error: invokeError } = await supabase.functions.invoke('submit-support-request', {
        body: {
          category,
          message: cleanedMessage,
          pagePath: `${location.pathname}${location.search}${location.hash}`,
          pageUrl: window.location.href,
          workspaceLabel: workspaceLabel ?? profile?.company_name ?? profile?.full_name ?? null,
          weddingId: weddingId ?? null,
          plannerClientId: plannerClientId ?? null,
          errorReference: errorReference ?? null,
          browserContext: {
            userAgent: window.navigator.userAgent,
            language: window.navigator.language,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          screenshot: screenshotPayload,
        },
      });

      if (invokeError) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : invokeError.message || 'We could not send your message.',
        );
      }

      setReference(typeof data?.reference === 'string' ? data.reference : 'Received');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto border-[#e6d5c4] bg-[linear-gradient(180deg,#fffdfa,#fbf6ef)] p-0 sm:max-w-2xl">
        {reference ? (
          <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-success/25 bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-success">Message received</p>
            <DialogTitle className="mt-2 font-editorial text-3xl">We’ll take it from here.</DialogTitle>
            <DialogDescription className="mx-auto mt-3 max-w-md leading-6">
              Your reference is <span className="font-semibold text-foreground">{reference}</span>. We also sent the message with your Zania account context so you do not need to explain everything again.
            </DialogDescription>
            <Button className="mt-7 min-w-32" onClick={resetAndClose}>Close</Button>
          </div>
        ) : (
          <>
            <div className="border-b border-[#eadbca] px-5 pb-5 pt-6 sm:px-7">
              <DialogHeader className="pr-8 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Help & feedback</p>
                <DialogTitle className="font-editorial text-2xl sm:text-3xl">Tell us what you need.</DialogTitle>
                <DialogDescription className="max-w-xl leading-6">
                  Send a short message. Zania will include your account, workspace, and current page automatically.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-6 px-5 py-5 sm:px-7">
              <fieldset>
                <legend className="text-sm font-semibold text-foreground">What can we help with?</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {categoryOptions.map((option) => {
                    const selected = category === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCategory(option.value)}
                        className={`flex min-h-20 items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                          selected
                            ? 'border-primary/45 bg-primary/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
                            : 'border-border/80 bg-background/70 hover:border-primary/25 hover:bg-background'
                        }`}
                      >
                        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <option.icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="zania-support-message">Tell us briefly</Label>
                <Textarea
                  id="zania-support-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 4000))}
                  placeholder="What happened, or what would you like Zania to improve?"
                  rows={5}
                  autoFocus
                />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Do not include passwords or payment PINs.</span>
                  <span>{message.length}/4000</span>
                </div>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => handleScreenshot(event.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-background/55 p-2 transition-colors hover:border-primary/35 hover:bg-background">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <ImagePlus className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {screenshot ? screenshot.name : 'Add a screenshot'}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {screenshot ? `${Math.ceil(screenshot.size / 1024)} KB · Tap to replace` : 'Optional · JPG, PNG, or WebP under 4 MB'}
                      </span>
                    </span>
                  </button>
                  {screenshot ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                      onClick={() => {
                        setScreenshot(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="rounded-2xl bg-muted/55 px-4 py-3 text-xs leading-5 text-muted-foreground">
                We’ll include your name, sign-in email, account type, workspace, current page, device details, and any error reference. Your screenshot is emailed to support but is not retained in Zania’s file storage.
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-[#eadbca] bg-background/65 px-5 py-4 sm:px-7">
              <Button variant="ghost" onClick={resetAndClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || message.trim().length < 5}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send to Zania
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
