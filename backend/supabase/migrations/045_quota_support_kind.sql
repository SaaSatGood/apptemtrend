-- 045_quota_support_kind.sql
-- Corrige a cota do assistente de suporte depois da 043/044: o backend usa
-- reserve_ai_quota_on/release_ai_quota_on com p_kind='support', mas a versão
-- criada na 043 aceitava apenas 'assistant' e 'kit' — o chat de suporte
-- respondia 500 com AI_QUOTA_STORE=database.
--
-- Adiciona também support_calls (equivalente à 035) de forma idempotente, para
-- que esta migration baste em ambientes novos.

ALTER TABLE public.ai_usage_daily
  ADD COLUMN IF NOT EXISTS support_calls integer NOT NULL DEFAULT 0;

ALTER TABLE public.ai_usage_daily
  DROP CONSTRAINT IF EXISTS ai_usage_daily_support_calls_check;

ALTER TABLE public.ai_usage_daily
  ADD CONSTRAINT ai_usage_daily_support_calls_check CHECK (support_calls >= 0);

CREATE OR REPLACE FUNCTION public.reserve_ai_quota_on(
  p_user_id uuid,
  p_kind text,
  p_daily_limit integer,
  p_usage_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF p_kind NOT IN ('assistant', 'kit', 'support') OR p_daily_limit < 1 THEN
    RAISE EXCEPTION 'Invalid AI quota parameters';
  END IF;

  INSERT INTO ai_usage_daily (user_id, usage_date)
  VALUES (p_user_id, p_usage_date)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  IF p_kind = 'assistant' THEN
    UPDATE ai_usage_daily
    SET assistant_calls = assistant_calls + 1, atualizado_em = now()
    WHERE user_id = p_user_id
      AND usage_date = p_usage_date
      AND assistant_calls < p_daily_limit;
  ELSIF p_kind = 'kit' THEN
    UPDATE ai_usage_daily
    SET kit_calls = kit_calls + 1, atualizado_em = now()
    WHERE user_id = p_user_id
      AND usage_date = p_usage_date
      AND kit_calls < p_daily_limit;
  ELSE
    UPDATE ai_usage_daily
    SET support_calls = support_calls + 1, atualizado_em = now()
    WHERE user_id = p_user_id
      AND usage_date = p_usage_date
      AND support_calls < p_daily_limit;
  END IF;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_quota_on(
  p_user_id uuid,
  p_kind text,
  p_usage_date date
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_usage_daily
  SET assistant_calls = CASE WHEN p_kind = 'assistant' THEN greatest(assistant_calls - 1, 0) ELSE assistant_calls END,
      kit_calls = CASE WHEN p_kind = 'kit' THEN greatest(kit_calls - 1, 0) ELSE kit_calls END,
      support_calls = CASE WHEN p_kind = 'support' THEN greatest(support_calls - 1, 0) ELSE support_calls END,
      atualizado_em = now()
  WHERE user_id = p_user_id AND usage_date = p_usage_date;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_quota_on(uuid, text, integer, date) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ai_quota_on(uuid, text, date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota_on(uuid, text, integer, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_quota_on(uuid, text, date) TO service_role;
