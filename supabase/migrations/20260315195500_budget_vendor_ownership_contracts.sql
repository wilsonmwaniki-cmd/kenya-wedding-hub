ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS committee_role_in_charge text,
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'not_required';

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS committee_role_in_charge text,
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.budget_categories
  DROP CONSTRAINT IF EXISTS budget_categories_contract_status_check,
  ADD CONSTRAINT budget_categories_contract_status_check
    CHECK (contract_status IN ('not_started', 'drafting', 'sent', 'signed', 'not_required'));

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_contract_status_check,
  ADD CONSTRAINT vendors_contract_status_check
    CHECK (contract_status IN ('not_started', 'drafting', 'sent', 'signed', 'not_required'));

UPDATE public.budget_categories
SET contract_status = CASE
  WHEN COALESCE(budget_scope, 'wedding') = 'personal' THEN 'not_required'
  WHEN contract_status IS NULL OR contract_status NOT IN ('not_started', 'drafting', 'sent', 'signed', 'not_required') THEN 'not_started'
  ELSE contract_status
END;

UPDATE public.vendors
SET contract_status = CASE
  WHEN contract_status IS NULL OR contract_status NOT IN ('not_started', 'drafting', 'sent', 'signed', 'not_required') THEN 'not_started'
  ELSE contract_status
END;

CREATE INDEX IF NOT EXISTS budget_categories_committee_role_idx
  ON public.budget_categories (committee_role_in_charge);

CREATE INDEX IF NOT EXISTS vendors_committee_role_idx
  ON public.vendors (committee_role_in_charge);
