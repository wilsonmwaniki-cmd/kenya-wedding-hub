# Commercial Documents Module Spec

## Goal

Build a shared commercial documents system for wedding professionals so vendors and planners can:

- create quotes
- create invoices
- issue receipts
- track payments against those documents
- connect those documents to a real couple, planner client, or vendor booking

This module closes the gap between what Zania currently promises in professional pricing and what the product actually supports.

## Product Position

This is not a generic accounting system.

It is a wedding-professional commercial workflow that lives inside Zania and stays tied to:

- vendor bookings
- planner clients
- couple-linked payment tracking

The first release should prioritize:

- clarity
- printable documents
- payment tracking
- couple-linked visibility where appropriate

It should not try to become a full ERP or e-signature platform on day one.

## Current State Summary

### Vendor side: current reality

Implemented today:

- vendor listing and business profile
- connection requests and booking visibility
- payment status tracking
- deposit / paid / balance tracking
- internal notes
- contract status labels

Missing today:

- quote document creation
- invoice document creation
- receipt issuing
- contract templates, uploads, and signatures

### Planner side: current reality

Implemented today:

- planner profile
- planner client linking
- client workspace management
- planner dashboard with weddings/clients

Missing today:

- planner-issued quotes
- planner-issued invoices
- receipts
- planner contract workflows

## Module Name

Use one shared internal module:

- `Commercial Documents`

User-facing language:

- `Quotes`
- `Invoices`
- `Receipts`

Later:

- `Contracts`

## Users

Primary:

- vendors
- planners

Secondary:

- couples who need visibility into vendor or planner financial requests

## Scope

### In scope for Phase 1

- create quotes
- create invoices
- create receipts
- line items
- payment recording against invoices
- printable views
- role-safe access for vendors and planners
- optional links to:
  - vendor booking
  - planner client
  - couple workspace
  - vendor listing

### Out of scope for Phase 1

- digital signatures
- contract templates
- email sending
- PDF generation service
- tax engine complexity
- M-Pesa collection integration
- public payment portal

## Data Model

### 1. `public.commercial_documents`

Purpose:

- header record for quote, invoice, or receipt

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `user_id uuid not null`
- `role text not null check (role in ('vendor', 'planner'))`
- `document_type text not null check (document_type in ('quote', 'invoice', 'receipt'))`
- `document_number text not null`
- `title text not null`
- `status text not null`
- `currency text not null default 'KES'`
- `recipient_name text not null`
- `recipient_email text null`
- `recipient_phone text null`
- `wedding_name text null`
- `client_id uuid null`
- `vendor_listing_id uuid null`
- `vendor_id uuid null`
- `quote_source_id uuid null`
- `subtotal numeric(12,2) not null default 0`
- `discount_amount numeric(12,2) not null default 0`
- `tax_amount numeric(12,2) not null default 0`
- `total_amount numeric(12,2) not null default 0`
- `amount_paid numeric(12,2) not null default 0`
- `balance_due numeric(12,2) not null default 0`
- `issue_date date not null default current_date`
- `due_date date null`
- `paid_date date null`
- `notes text null`
- `terms text null`
- `metadata jsonb not null default '{}'::jsonb`

Status rules:

- quote:
  - `draft`
  - `sent`
  - `accepted`
  - `rejected`
  - `expired`
- invoice:
  - `draft`
  - `sent`
  - `part_paid`
  - `paid`
  - `void`
- receipt:
  - `issued`
  - `void`

Indexes:

- `commercial_documents_user_id_idx`
- `commercial_documents_role_idx`
- `commercial_documents_document_type_idx`
- `commercial_documents_client_id_idx`
- `commercial_documents_vendor_listing_id_idx`
- `commercial_documents_vendor_id_idx`
- `commercial_documents_issue_date_idx`
- unique:
  - `commercial_documents_document_number_user_id_key`

Notes:

- `quote_source_id` allows invoice-from-quote and receipt-from-invoice lineage
- `vendor_id` links to the couple-side selected vendor record
- `client_id` links to `planner_clients.id`

### 2. `public.commercial_document_items`

Purpose:

- line items per document

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `document_id uuid not null references public.commercial_documents(id) on delete cascade`
- `sort_order integer not null default 0`
- `description text not null`
- `quantity numeric(12,2) not null default 1`
- `unit_price numeric(12,2) not null default 0`
- `line_total numeric(12,2) not null default 0`
- `metadata jsonb not null default '{}'::jsonb`

Indexes:

- `commercial_document_items_document_id_idx`
- `commercial_document_items_sort_order_idx`

### 3. `public.commercial_document_payments`

Purpose:

- payment events attached to an invoice or receipt flow

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `document_id uuid not null references public.commercial_documents(id) on delete cascade`
- `amount numeric(12,2) not null`
- `payment_date date not null default current_date`
- `payment_method text not null check (payment_method in ('mpesa', 'bank', 'cash', 'card', 'other'))`
- `reference text null`
- `notes text null`
- `recorded_by uuid not null`
- `budget_payment_id uuid null`

Indexes:

- `commercial_document_payments_document_id_idx`
- `commercial_document_payments_payment_date_idx`

### 4. Optional later table: `public.contract_documents`

Not Phase 1. Mentioned here so we don’t overfit `commercial_documents` into contract use.

## Access Model

### Vendor access

A vendor can access a document when:

- `commercial_documents.user_id = auth.uid()`
- `commercial_documents.role = 'vendor'`

They can optionally attach it to:

- their own `vendor_listing_id`
- a couple booking in `vendors.id`

### Planner access

A planner can access a document when:

- `commercial_documents.user_id = auth.uid()`
- `commercial_documents.role = 'planner'`

They can optionally attach it to:

- `planner_clients.id`

### Couple visibility

Phase 1:

- no direct couple editing
- optional read-only rendering later if document is linked to the couple-side vendor entry

## RLS Rules

### `commercial_documents`

Policies:

- users can select their own documents
- users can insert their own documents
- users can update their own documents
- users can delete their own draft documents

Future:

- optional couple read access on linked documents

### `commercial_document_items`

Policies:

- access is inherited through parent `commercial_documents`

### `commercial_document_payments`

Policies:

- access is inherited through parent `commercial_documents`

## RPC / SQL Helpers

### `public.create_commercial_document(...)`

Creates a document header and returns `document_id`.

Input:

- role
- document_type
- title
- recipient_name
- recipient_email
- recipient_phone
- client_id
- vendor_listing_id
- vendor_id
- issue_date
- due_date
- notes
- terms

Output:

- created document row

### `public.save_commercial_document_items(_document_id uuid, _items jsonb)`

Replaces all line items for a document.

Behavior:

- deletes existing items
- inserts normalized new items
- recalculates subtotal and total

### `public.record_commercial_document_payment(...)`

Creates a payment row and recalculates:

- amount_paid
- balance_due
- invoice status
- paid_date

Optional:

- if linked to a couple-side vendor, also creates or updates a `budget_payments` record

### `public.convert_quote_to_invoice(_quote_id uuid, _issue_date date, _due_date date)`

Behavior:

- duplicates quote header
- duplicates line items
- creates invoice
- links `quote_source_id`

### `public.issue_receipt_from_payment(_document_id uuid, _payment_id uuid)`

Behavior:

- creates a `receipt` document from a recorded payment

## Document Numbering

Phase 1 should generate readable numbers.

Examples:

- quote:
  - `QT-2026-0001`
- invoice:
  - `INV-2026-0001`
- receipt:
  - `RCT-2026-0001`

Generation strategy:

- per user
- per document type
- year-based sequence

## UI Design

## Shared principles

- same commercial engine
- role-specific wording
- printable web layout first
- PDF later

### Vendor screens

#### A. `/vendor-documents`

Top summary:

- open quotes
- unpaid invoices
- amount outstanding
- receipts issued this month

Tabs:

- Quotes
- Invoices
- Receipts

Primary actions:

- `New quote`
- `New invoice`

List row fields:

- document number
- recipient
- linked booking
- amount
- status
- issue date
- due date

Row actions:

- view
- edit
- duplicate
- convert to invoice
- record payment
- issue receipt
- print

#### B. Vendor booking detail panel integration

In `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorDashboard.tsx`

Add `Commercial docs` section per booking:

- latest quote
- latest invoice
- latest receipt
- outstanding balance
- quick buttons:
  - `Create quote`
  - `Create invoice`
  - `Record payment`

### Planner screens

#### A. `/planner-documents`

Top summary:

- open quotes
- unpaid invoices
- total billed this month
- receipts issued

Tabs:

- Quotes
- Invoices
- Receipts

Primary actions:

- `New quote`
- `New invoice`

Filters:

- all clients
- by client
- by status

#### B. Planner client context integration

Inside `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/PlannerDashboard.tsx`

For each client:

- `Commercial docs`
- amount billed
- outstanding balance
- last invoice date

Quick actions:

- `Quote client`
- `Invoice client`

### Shared document editor

Screen or drawer:

- header:
  - doc type
  - status
  - document number
- recipient block
- linked entity block:
  - booking or client
- line items table
- subtotal/discount/tax/total summary
- notes
- terms

Actions:

- save draft
- mark sent
- convert to invoice
- record payment
- print

### Shared printable view

Each document gets a clean print page:

- brand
- document number
- issued to
- issue / due dates
- line items
- totals
- notes / terms

This is enough for Phase 1.

## Planner vs Vendor Comparison

### Vendor

Today:

- stronger booking-linked context
- stronger payment-state context
- weaker document generation

Best Phase 1 fit:

- build vendor document flow first

### Planner

Today:

- stronger client workspace model
- weaker commercial operations layer

Best Phase 1 fit:

- reuse same engine after vendor UI is stable

## Couple-linked Integration

This is where Zania becomes differentiated.

If a document is linked to a couple-side vendor:

- invoice total can appear in wedding financial context
- recorded payments can sync into `budget_payments`
- receipt can appear in the couple payment trail

If linked to planner client:

- planner fee can be visible in planner-client context later

Phase 1:

- optional sync from professional payment records to `budget_payments`
- read-only couple visibility can wait until Phase 2

## Implementation Plan

### Step 1. Backend foundation

Create migrations for:

- `commercial_documents`
- `commercial_document_items`
- `commercial_document_payments`
- triggers for `updated_at`
- helper functions for totals
- RLS policies

### Step 2. Shared client library

Add:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/commercialDocuments.ts`

Functions:

- `createCommercialDocument`
- `updateCommercialDocument`
- `saveCommercialDocumentItems`
- `listCommercialDocuments`
- `recordCommercialDocumentPayment`
- `convertQuoteToInvoice`
- `issueReceiptFromPayment`

Types:

- `CommercialDocument`
- `CommercialDocumentItem`
- `CommercialDocumentPayment`

### Step 3. Vendor UI

Build first:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorDocuments.tsx`
- add navigation link in vendor sidebar
- add booking-level shortcuts in `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorDashboard.tsx`

### Step 4. Printable views

Add:

- shared print layout component
- print action for quote/invoice/receipt

### Step 5. Planner UI

Build:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/PlannerDocuments.tsx`
- add planner sidebar link
- add client-level shortcuts in planner dashboard

### Step 6. Couple-linked sync

Build optional sync:

- payment recorded on vendor invoice
- create/update `budget_payments`

## MVP Acceptance Criteria

### Vendor

- can create quote from scratch
- can create invoice from scratch
- can convert quote to invoice
- can record payment
- can issue receipt
- can print each document

### Planner

- can create quote for client
- can create invoice for client
- can record payment
- can issue receipt
- can print each document

### System

- totals recalculate correctly
- status changes correctly
- RLS blocks cross-account access
- document numbers are unique per user/type/year

## Risks

### Risk 1. Overbuilding finance too early

Mitigation:

- keep to internal printable docs first

### Risk 2. Complex couple sync

Mitigation:

- make payment sync optional and additive

### Risk 3. Contract scope creep

Mitigation:

- keep contracts out of Phase 1 implementation

## Recommendation

Build this next as a shared engine with vendor UI first.

Why:

- vendor side already has booking and payment context
- vendors will feel the value immediately
- planner can then reuse the same primitives instead of creating a second parallel system

## Suggested Build Sequence

1. backend schema + RLS
2. shared document library
3. vendor quotes/invoices/receipts UI
4. print views
5. planner document UI
6. couple-linked payment sync

