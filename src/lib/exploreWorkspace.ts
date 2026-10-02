export type ExploreSection = 'home' | 'budget' | 'tasks' | 'vendors' | 'documents';

export type ExploreTask = {
  id: string;
  title: string;
  detail: string;
  category: string;
  completed: boolean;
};

export type ExploreVendorStatus = 'Saved' | 'Considering' | 'Quote received' | 'Booked';

export type ExploreVendor = {
  id: string;
  name: string;
  category: string;
  status: ExploreVendorStatus;
  contact: string;
};

export type ExploreDocumentType = 'Quote' | 'Invoice' | 'Contract' | 'Receipt';
export type ExploreDocumentStatus = 'Sent' | 'Accepted' | 'Payment due' | 'Paid' | 'Awaiting signature' | 'Signed' | 'Issued';

export type ExploreDocument = {
  id: string;
  vendorId: string;
  number: string;
  title: string;
  type: ExploreDocumentType;
  status: ExploreDocumentStatus;
  amount: number;
  notes: string;
};

export type ExploreBudgetItem = {
  id: string;
  name: string;
  allocated: number;
  spent: number;
};

export type ExploreWorkspace = {
  version: 1;
  weddingName: string;
  weddingDate: string;
  guestCount: number;
  tasks: ExploreTask[];
  vendors: ExploreVendor[];
  documents: ExploreDocument[];
  budget: ExploreBudgetItem[];
};

export const EXPLORE_STORAGE_KEY = 'zania:explore-workspace:v1';

export const EXPLORE_VENDOR_STATUSES: ExploreVendorStatus[] = ['Saved', 'Considering', 'Quote received', 'Booked'];

export const EXPLORE_DOCUMENT_STATUSES: Record<ExploreDocumentType, ExploreDocumentStatus[]> = {
  Quote: ['Sent', 'Accepted'],
  Invoice: ['Sent', 'Payment due', 'Paid'],
  Contract: ['Sent', 'Awaiting signature', 'Signed'],
  Receipt: ['Issued'],
};

const DEFAULT_EXPLORE_WORKSPACE: ExploreWorkspace = {
  version: 1,
  weddingName: 'Amina & Kamau',
  weddingDate: '2027-04-24',
  guestCount: 120,
  tasks: [
    { id: 'task-venue', title: 'Confirm final venue walkthrough', detail: 'Due this week', category: 'Venue', completed: false },
    { id: 'task-catering', title: 'Review Garden Table quote', detail: 'Quote is ready to accept', category: 'Catering', completed: false },
    { id: 'task-contract', title: 'Sign décor services contract', detail: 'Waiting for both partners', category: 'Décor', completed: false },
    { id: 'task-guests', title: 'Draft the first guest list', detail: 'Completed together', category: 'Guests', completed: true },
    { id: 'task-photo', title: 'Pay photography booking fee', detail: 'Receipt filed in Documents', category: 'Photography', completed: true },
  ],
  vendors: [
    { id: 'vendor-venue', name: 'Karura Gardens', category: 'Venue', status: 'Booked', contact: '+254 700 100 200' },
    { id: 'vendor-photo', name: 'Maya Studios', category: 'Photography', status: 'Booked', contact: 'hello@mayastudios.example' },
    { id: 'vendor-catering', name: 'Garden Table', category: 'Catering', status: 'Quote received', contact: '+254 711 400 500' },
    { id: 'vendor-decor', name: 'Nairobi Blooms', category: 'Décor', status: 'Considering', contact: 'studio@nairobiblooms.example' },
  ],
  documents: [
    { id: 'doc-quote', vendorId: 'vendor-catering', number: 'QT-2026-0142', title: 'Reception catering package', type: 'Quote', status: 'Sent', amount: 360000, notes: 'Buffet service for 120 guests.' },
    { id: 'doc-invoice-photo', vendorId: 'vendor-photo', number: 'INV-2026-0088', title: 'Photography booking fee', type: 'Invoice', status: 'Paid', amount: 165000, notes: 'Full-day wedding photography coverage.' },
    { id: 'doc-receipt-photo', vendorId: 'vendor-photo', number: 'RCT-2026-0041', title: 'Photography payment receipt', type: 'Receipt', status: 'Issued', amount: 165000, notes: 'Payment received through Zania Pay.' },
    { id: 'doc-contract-venue', vendorId: 'vendor-venue', number: 'CTR-2026-0019', title: 'Venue hire agreement', type: 'Contract', status: 'Signed', amount: 420000, notes: 'Garden ceremony and reception hall.' },
    { id: 'doc-contract-decor', vendorId: 'vendor-decor', number: 'CTR-2026-0024', title: 'Décor services agreement', type: 'Contract', status: 'Awaiting signature', amount: 150000, notes: 'Florals, ceremony arch and reception tables.' },
  ],
  budget: [
    { id: 'budget-venue', name: 'Venue', allocated: 420000, spent: 120000 },
    { id: 'budget-catering', name: 'Catering', allocated: 360000, spent: 0 },
    { id: 'budget-photo', name: 'Photography', allocated: 165000, spent: 165000 },
    { id: 'budget-decor', name: 'Décor', allocated: 150000, spent: 0 },
    { id: 'budget-attire', name: 'Attire', allocated: 180000, spent: 65000 },
    { id: 'budget-entertainment', name: 'Entertainment', allocated: 90000, spent: 0 },
    { id: 'budget-transport', name: 'Transport', allocated: 60000, spent: 0 },
    { id: 'budget-beauty', name: 'Beauty', allocated: 45000, spent: 0 },
    { id: 'budget-invitations', name: 'Invitations', allocated: 30000, spent: 12000 },
  ],
};

export function createDefaultExploreWorkspace(): ExploreWorkspace {
  return JSON.parse(JSON.stringify(DEFAULT_EXPLORE_WORKSPACE)) as ExploreWorkspace;
}

export function loadExploreWorkspace(): ExploreWorkspace {
  if (typeof window === 'undefined') return createDefaultExploreWorkspace();

  try {
    const stored = window.localStorage.getItem(EXPLORE_STORAGE_KEY);
    if (!stored) return createDefaultExploreWorkspace();
    const parsed = JSON.parse(stored) as Partial<ExploreWorkspace>;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.documents)) {
      return createDefaultExploreWorkspace();
    }
    return parsed as ExploreWorkspace;
  } catch {
    return createDefaultExploreWorkspace();
  }
}

export function saveExploreWorkspace(workspace: ExploreWorkspace) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPLORE_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // The demo still works in memory when browser storage is unavailable.
  }
}

export function formatKes(value: number) {
  return `KES ${Math.max(0, value).toLocaleString('en-KE')}`;
}
