import type {
  CommercialDocumentRole,
  DocumentTemplateItem,
  ProfessionalTemplateType,
} from '@/lib/commercialDocuments';

export type DocumentTemplateStarter = {
  key: string;
  templateType: ProfessionalTemplateType;
  name: string;
  description: string;
  defaultTitle: string;
  defaultNotes: string;
  defaultTerms: string;
  defaultItems: DocumentTemplateItem[];
  legalNote: string;
};

function baseProviderLabel(role: CommercialDocumentRole) {
  return role === 'planner' ? 'planner' : 'service provider';
}

export function getKenyanDocumentTemplateStarters(role: CommercialDocumentRole): DocumentTemplateStarter[] {
  const providerLabel = baseProviderLabel(role);
  const serviceLabel = role === 'planner' ? 'wedding planning' : 'wedding services';

  return [
    {
      key: 'kenya-quote-starter',
      templateType: 'quote',
      name: 'Kenya Wedding Quote Starter',
      description:
        'A Kenya-ready quote outline with scope, pricing, taxes, validity period, and booking language for wedding work.',
      defaultTitle: `${role === 'planner' ? 'Wedding Planning' : 'Wedding Services'} Quote`,
      defaultNotes:
        'Customise the scope, dates, and commercial assumptions before you share this quote. Confirm whether VAT applies to your business and whether the final invoice must be generated through eTIMS.',
      defaultTerms:
        `1. This quote is issued in Kenya Shillings (KES) and is valid for 14 days unless another validity period is stated in writing.\n\n2. The quoted scope covers only the services and deliverables listed below. Any extra hours, change requests, additional crew, transport outside the agreed area, venue access fees, permits, or third-party charges will be quoted separately.\n\n3. A booking is only confirmed after written acceptance and receipt of the agreed booking deposit.\n\n4. Prices stated here are exclusive of VAT unless expressly marked otherwise. Where applicable under Kenyan tax law, the final invoice should include the supplier's KRA PIN, VAT details, and any eTIMS-compliant invoice reference.\n\n5. This quote is a commercial proposal, not a binding contract on its own. The final engagement should be governed by the signed service agreement and any approved invoice terms.`,
      defaultItems: [
        { description: `${role === 'planner' ? 'Wedding planning and coordination fee' : 'Primary service fee'}`, quantity: 1, unitPrice: 0 },
        { description: 'Planning meetings / consultation sessions', quantity: 3, unitPrice: 0 },
        { description: 'Wedding day coordination / on-site delivery', quantity: 1, unitPrice: 0 },
      ],
      legalNote:
        'Built as a general Kenya-ready quote starter. Review commercial terms, taxes, and business details before sending.',
    },
    {
      key: 'kenya-invoice-starter',
      templateType: 'invoice',
      name: 'Kenya Wedding Invoice Starter',
      description:
        'A practical invoice starter for Kenya-based wedding businesses with payment terms, KRA/eTIMS reminders, and balance follow-up language.',
      defaultTitle: `${role === 'planner' ? 'Wedding Planning' : 'Wedding Services'} Invoice`,
      defaultNotes:
        'Fill in your business name, address, KRA PIN, VAT status, eTIMS details where required, and the client reference for this booking before issuing.',
      defaultTerms:
        `1. Payment is due on or before the stated due date.\n\n2. Please pay using the approved business channel and quote the invoice number or payment reference in every transfer.\n\n3. If your business is required to issue electronic tax invoices in Kenya, generate and transmit the invoice through the applicable KRA eTIMS flow and include the relevant invoice reference.\n\n4. Any dispute or billing query should be raised promptly in writing so the parties can reconcile the account before the event or next delivery milestone.\n\n5. Late settlement may affect delivery timelines, release of final work, or continuation of services where the signed engagement terms allow this.`,
      defaultItems: [
        { description: `${serviceLabel} fee`, quantity: 1, unitPrice: 0 },
        { description: 'Approved additional services / extras', quantity: 1, unitPrice: 0 },
      ],
      legalNote:
        'Designed as a Kenya-based invoice starter. Confirm tax treatment, invoice numbering, and eTIMS obligations with your accountant.',
    },
    {
      key: 'kenya-receipt-starter',
      templateType: 'receipt',
      name: 'Kenya Wedding Receipt Starter',
      description:
        'A clear receipt starter for recording money received against a quote or invoice, with room for method, date, and reference details.',
      defaultTitle: 'Official Receipt',
      defaultNotes:
        'Use this after payment is actually received. Link it to the related invoice or booking reference and keep the payment method / transaction code consistent with your books.',
      defaultTerms:
        `1. This receipt acknowledges payment actually received by the ${providerLabel}.\n\n2. State the related invoice number, booking reference, payment method, transaction code, and payment date clearly.\n\n3. Where the payment relates to a Kenya tax invoice or eTIMS-generated invoice, keep the receipt details aligned to the source invoice for audit and reconciliation purposes.\n\n4. This receipt should be retained together with the related invoice, contract, and payment records.`,
      defaultItems: [
        { description: 'Deposit received', quantity: 1, unitPrice: 0 },
      ],
      legalNote:
        'Use as a payment-record starter. Confirm your final receipt format against your bookkeeping and tax process.',
    },
    {
      key: 'kenya-contract-starter',
      templateType: 'contract',
      name: role === 'planner' ? 'Kenya Wedding Planning Contract Starter' : 'Kenya Wedding Services Contract Starter',
      description:
        'A general service agreement starter for Kenya-based wedding work, covering scope, fees, changes, privacy, cancellations, and governing law.',
      defaultTitle: role === 'planner' ? 'Wedding Planning Services Agreement' : 'Wedding Services Agreement',
      defaultNotes:
        'This is a starter only. Replace placeholders, align it to the actual service scope, and have Kenyan counsel review it before relying on it for live bookings.',
      defaultTerms:
        `1. Parties and scope. This agreement sets out the ${serviceLabel} to be provided, the event details, and the commercial terms agreed between the parties.\n\n2. Fees and payment schedule. The client shall pay the agreed fees, deposits, and milestone amounts on the dates stated in this agreement or in the issued invoice schedule.\n\n3. Changes and additional work. Any change to scope, timing, location, guest count, deliverables, staffing, or production requirements may require a written variation and additional fees.\n\n4. Cancellation and rescheduling. The agreement should state what happens to deposits, committed third-party costs, and rescheduled dates if the event is postponed, cancelled, or materially changed.\n\n5. Client responsibilities. The client should provide timely approvals, accurate event information, lawful access to venues, and any permits, licences, or third-party approvals the service depends on.\n\n6. Personal data and privacy. The parties should only collect and use personal data for the wedding engagement, keep it secure, and handle it in line with the Kenya Data Protection Act, 2019.\n\n7. Liability and force majeure. The agreement should define responsibility for third-party failures, venue disruptions, unsafe conditions, weather, civil unrest, illness, or other events outside reasonable control.\n\n8. Governing law. This agreement shall be governed by the laws of Kenya, and disputes should first be escalated in good faith before court or other dispute steps specified by the parties in writing.\n\n9. Entire agreement and amendments. Any changes to this agreement should be recorded in writing and approved by both parties.`,
      defaultItems: [
        { description: `${role === 'planner' ? 'Planning scope and deliverables schedule' : 'Services and deliverables schedule'}`, quantity: 1, unitPrice: 0 },
        { description: 'Payment schedule / deposit milestones', quantity: 1, unitPrice: 0 },
        { description: 'Cancellation / rescheduling terms', quantity: 1, unitPrice: 0 },
      ],
      legalNote:
        'General Kenyan contract starter only. It should be reviewed and adapted by a qualified Kenyan lawyer before use.',
    },
  ];
}
