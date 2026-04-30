-- Token accounting hardening.
-- Run after 000_full_setup.sql.

CREATE UNIQUE INDEX IF NOT EXISTS uq_token_wallets_user_personal
  ON public.token_wallets(user_id)
  WHERE org_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_token_wallets_user_org
  ON public.token_wallets(user_id, org_id)
  WHERE org_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can insert own generated_ids" ON public.generated_ids;

CREATE OR REPLACE FUNCTION public.deduct_tokens_atomic(
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_amount INTEGER DEFAULT 1,
  p_description TEXT DEFAULT 'Card generation',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  wallet_id UUID,
  balance INTEGER,
  lifetime_used INTEGER,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.token_wallets%ROWTYPE;
  v_transaction public.token_transactions%ROWTYPE;
  v_existing public.token_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  IF p_reference_id IS NOT NULL THEN
    SELECT *
      INTO v_existing
      FROM public.token_transactions
     WHERE user_id = p_user_id
       AND reference_id = p_reference_id
       AND type = 'usage'
       AND NOT EXISTS (
         SELECT 1
           FROM public.token_transactions refunded
          WHERE refunded.user_id = p_user_id
            AND refunded.reference_id = p_reference_id
            AND refunded.type = 'refund'
       )
     LIMIT 1;

    IF FOUND THEN
      SELECT *
        INTO v_wallet
        FROM public.token_wallets
       WHERE id = v_existing.wallet_id;

      wallet_id := v_existing.wallet_id;
      balance := v_existing.balance_after;
      lifetime_used := COALESCE(v_wallet.lifetime_used, 0);
      transaction_id := v_existing.id;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || COALESCE(p_org_id::TEXT, 'personal'), 0)
  );

  SELECT *
    INTO v_wallet
    FROM public.token_wallets
   WHERE user_id = p_user_id
     AND ((p_org_id IS NULL AND org_id IS NULL) OR org_id = p_org_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.token_wallets (
      user_id,
      org_id,
      balance,
      lifetime_purchased,
      lifetime_used
    )
    VALUES (p_user_id, p_org_id, 50, 50, 0)
    RETURNING * INTO v_wallet;

    INSERT INTO public.token_transactions (
      wallet_id,
      user_id,
      org_id,
      amount,
      type,
      description,
      reference_id,
      balance_after
    )
    VALUES (
      v_wallet.id,
      p_user_id,
      p_org_id,
      50,
      'bonus',
      'Welcome bonus - 50 free tokens',
      NULL,
      50
    );
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_TOKENS:%', v_wallet.balance USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.token_wallets
     SET balance = balance - p_amount,
         lifetime_used = lifetime_used + p_amount
   WHERE id = v_wallet.id
   RETURNING * INTO v_wallet;

  INSERT INTO public.token_transactions (
    wallet_id,
    user_id,
    org_id,
    amount,
    type,
    description,
    reference_id,
    balance_after
  )
  VALUES (
    v_wallet.id,
    p_user_id,
    p_org_id,
    -p_amount,
    'usage',
    p_description,
    p_reference_id,
    v_wallet.balance
  )
  RETURNING * INTO v_transaction;

  wallet_id := v_wallet.id;
  balance := v_wallet.balance;
  lifetime_used := v_wallet.lifetime_used;
  transaction_id := v_transaction.id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_tokens_atomic(
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_amount INTEGER DEFAULT 1,
  p_type TEXT DEFAULT 'purchase',
  p_description TEXT DEFAULT 'Token credit',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  wallet_id UUID,
  balance INTEGER,
  lifetime_purchased INTEGER,
  lifetime_used INTEGER,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.token_wallets%ROWTYPE;
  v_transaction public.token_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  IF p_type NOT IN ('purchase', 'refund', 'bonus', 'adjustment') THEN
    RAISE EXCEPTION 'INVALID_TYPE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || COALESCE(p_org_id::TEXT, 'personal'), 0)
  );

  SELECT *
    INTO v_wallet
    FROM public.token_wallets
   WHERE user_id = p_user_id
     AND ((p_org_id IS NULL AND org_id IS NULL) OR org_id = p_org_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.token_wallets (
      user_id,
      org_id,
      balance,
      lifetime_purchased,
      lifetime_used
    )
    VALUES (p_user_id, p_org_id, 50, 50, 0)
    RETURNING * INTO v_wallet;

    INSERT INTO public.token_transactions (
      wallet_id,
      user_id,
      org_id,
      amount,
      type,
      description,
      reference_id,
      balance_after
    )
    VALUES (
      v_wallet.id,
      p_user_id,
      p_org_id,
      50,
      'bonus',
      'Welcome bonus - 50 free tokens',
      NULL,
      50
    );
  END IF;

  UPDATE public.token_wallets
     SET balance = balance + p_amount,
         lifetime_purchased = CASE
           WHEN p_type = 'purchase' THEN lifetime_purchased + p_amount
           ELSE lifetime_purchased
         END
   WHERE id = v_wallet.id
   RETURNING * INTO v_wallet;

  INSERT INTO public.token_transactions (
    wallet_id,
    user_id,
    org_id,
    amount,
    type,
    description,
    reference_id,
    balance_after
  )
  VALUES (
    v_wallet.id,
    p_user_id,
    p_org_id,
    p_amount,
    p_type,
    p_description,
    p_reference_id,
    v_wallet.balance
  )
  RETURNING * INTO v_transaction;

  wallet_id := v_wallet.id;
  balance := v_wallet.balance;
  lifetime_purchased := v_wallet.lifetime_purchased;
  lifetime_used := v_wallet.lifetime_used;
  transaction_id := v_transaction.id;
  RETURN NEXT;
END;
$$;
