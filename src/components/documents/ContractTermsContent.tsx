import SafeMarkdown from '@/components/SafeMarkdown';

type ContractTermsContentProps = {
  terms?: string | null;
};

export default function ContractTermsContent({ terms }: ContractTermsContentProps) {
  return (
    <SafeMarkdown
      components={{
        h2: ({ children }) => <h3 className="mb-2 mt-8 font-display text-xl font-semibold first:mt-0">{children}</h3>,
        h3: ({ children }) => <h4 className="mb-2 mt-6 text-base font-semibold">{children}</h4>,
        p: ({ children }) => <p className="mb-4 whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="mb-5 list-disc space-y-1.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-5 list-decimal space-y-1.5 pl-5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {terms || 'No agreement details have been added yet.'}
    </SafeMarkdown>
  );
}
