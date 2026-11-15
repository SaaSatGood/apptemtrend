-- Support chat AI quota (per-user, daily).
-- Adds a third counter so support messages never consume search/kit quotas.

ALTER TABLE public.ai_usage_daily
  ADD COLUMN IF NOT EXISTS support_calls integer NOT NULL DEFAULT 0
  CHECK (support_calls >= 0);

CREATE OR REPLACE FUNCTION public.reserve_ai_quota(
  p_user_id uuid,
  p_kind text,
  p_daily_limit integer
) RETURNS boolean
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
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  IF p_kind = 'assistant' THEN
    UPDATE ai_usage_daily
      SET assistant_calls = assistant_calls + 1, atualizado_em = now()
      WHERE user_id = p_user_id AND usage_date = CURRENT_DATE
        AND assistant_calls < p_daily_limit;
  ELSIF p_kind = 'kit' THEN
    UPDATE ai_usage_daily
      SET kit_calls = kit_calls + 1, atualizado_em = now()
      WHERE user_id = p_user_id AND usage_date = CURRENT_DATE
        AND kit_calls < p_daily_limit;
  ELSE
    UPDATE ai_usage_daily
      SET support_calls = support_calls + 1, atualizado_em = now()
      WHERE user_id = p_user_id AND usage_date = CURRENT_DATE
        AND support_calls < p_daily_limit;
  END IF;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_quota(p_user_id uuid, p_kind text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_usage_daily
  SET assistant_calls = CASE WHEN p_kind = 'assistant' THEN GREATEST(assistant_calls - 1, 0) ELSE assistant_calls END,
      kit_calls = CASE WHEN p_kind = 'kit' THEN GREATEST(kit_calls - 1, 0) ELSE kit_calls END,
      support_calls = CASE WHEN p_kind = 'support' THEN GREATEST(support_calls - 1, 0) ELSE support_calls END,
      atualizado_em = now()
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_quota(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_ai_quota(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_quota(uuid, text) TO service_role;
