ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_due_date date NULL,
ADD COLUMN IF NOT EXISTS last_payment_at timestamptz NULL;

ALTER TABLE public.vendors
DROP CONSTRAINT IF EXISTS vendors_payment_status_check;

ALTER TABLE public.vendors
ADD CONSTRAINT vendors_payment_status_check
CHECK (payment_status IN ('unpaid', 'deposit_due', 'deposit_paid', 'part_paid', 'paid_full'));

ALTER TABLE public.vendors
DROP CONSTRAINT IF EXISTS vendors_deposit_amount_nonnegative_check;

ALTER TABLE public.vendors
ADD CONSTRAINT vendors_deposit_amount_nonnegative_check
CHECK (deposit_amount >= 0);

ALTER TABLE public.vendors
DROP CONSTRAINT IF EXISTS vendors_amount_paid_nonnegative_check;

ALTER TABLE public.vendors
ADD CONSTRAINT vendors_amount_paid_nonnegative_check
CHECK (amount_paid >= 0);

UPDATE public.vendors
SET
  deposit_amount = COALESCE(deposit_amount, 0),
  amount_paid = CASE
    WHEN status = 'completed' AND price IS NOT NULL THEN GREATEST(COALESCE(amount_paid, 0), price)
    ELSE COALESCE(amount_paid, 0)
  END,
  payment_status = CASE
    WHEN status = 'completed' AND price IS NOT NULL THEN 'paid_full'
    WHEN COALESCE(amount_paid, 0) > 0 THEN 'part_paid'
    ELSE COALESCE(payment_status, 'unpaid')
  END
WHERE deposit_amount IS NULL
   OR amount_paid IS NULL
   OR payment_status IS NULL;

CREATE OR REPLACE FUNCTION public.update_vendor_payment_state(
  vendor_id_input uuid,
  contract_amount_input numeric DEFAULT NULL,
  deposit_amount_input numeric DEFAULT 0,
  amount_paid_input numeric DEFAULT 0,
  payment_status_input text DEFAULT 'unpaid',
  payment_due_date_input date DEFAULT NULL
)
RETURNS public.vendors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_vendor public.vendors%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501';
  END IF;

  IF payment_status_input NOT IN ('unpaid', 'deposit_due', 'deposit_paid', 'part_paid', 'paid_full') THEN
    RAISE EXCEPTION 'Invalid payment status'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(deposit_amount_input, 0) < 0 OR COALESCE(amount_paid_input, 0) < 0 THEN
    RAISE EXCEPTION 'Payment amounts must be zero or greater'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO target_vendor
  FROM public.vendors
  WHERE id = vendor_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor row not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF target_vendor.user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.vendors
  SET
    price = COALESCE(contract_amount_input, price),
    deposit_amount = COALESCE(deposit_amount_input, 0),
    amount_paid = COALESCE(amount_paid_input, 0),
    payment_status = payment_status_input,
    payment_due_date = payment_due_date_input,
    last_payment_at = CASE
      WHEN COALESCE(amount_paid_input, 0) > COALESCE(target_vendor.amount_paid, 0) THEN now()
      ELSE target_vendor.last_payment_at
    END
  WHERE id = target_vendor.id
  RETURNING * INTO target_vendor;

  RETURN target_vendor;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_vendor_payment_state(uuid, numeric, numeric, numeric, text, date) TO authenticated;
