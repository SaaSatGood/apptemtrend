-- Persistent, atomic AI quotas and force-new cooldowns.
-- Backend service_role is the only caller; no client grants are exposed.

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  assistant_calls integer NOT NULL DEFAULT 0 CHECK (assistant_calls >= 0),
  kit_calls integer NOT NULL DEFAULT 0 CHECK (kit_calls >= 0),
  prompt_chars bigint NOT NULL DEFAULT 0 CHECK (prompt_chars >= 0),
  total_tokens bigint NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE TABLE IF NOT EXISTS public.ai_force_new_cooldowns (
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (creator_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.ai_metrics_daily (
  usage_date date PRIMARY KEY DEFAULT CURRENT_DATE,
  classify_calls bigint NOT NULL DEFAULT 0,
  classify_tokens bigint NOT NULL DEFAULT 0,
  classify_prompt_chars bigint NOT NULL DEFAULT 0,
  classify_cache_hits bigint NOT NULL DEFAULT 0,
  generate_calls bigint NOT NULL DEFAULT 0,
  generate_tokens bigint NOT NULL DEFAULT 0,
  generate_prompt_chars bigint NOT NULL DEFAULT 0,
  generate_retries bigint NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_force_new_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_ai_metrics(
  p_kind text,
  p_tokens integer DEFAULT 0,
  p_prompt_chars integer DEFAULT 0,
  p_retries integer DEFAULT 0,
  p_cached boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_kind NOT IN ('classify', 'generate') THEN RAISE EXCEPTION 'Invalid AI metric kind'; END IF;
  INSERT INTO ai_metrics_daily (usage_date) VALUES (CURRENT_DATE)
  ON CONFLICT (usage_date) DO NOTHING;
  IF p_kind = 'classify' THEN
    UPDATE ai_metrics_daily SET
      classify_calls = classify_calls + CASE WHEN p_cached THEN 0 ELSE 1 END,
      classify_tokens = classify_tokens + GREATEST(p_tokens, 0),
      classify_prompt_chars = classify_prompt_chars + GREATEST(p_prompt_chars, 0),
      classify_cache_hits = classify_cache_hits + CASE WHEN p_cached THEN 1 ELSE 0 END,
      atualizado_em = now()
    WHERE usage_date = CURRENT_DATE;
  ELSE
    UPDATE ai_metrics_daily SET
      generate_calls = generate_calls + 1,
      generate_tokens = generate_tokens + GREATEST(p_tokens, 0),
      generate_prompt_chars = generate_prompt_chars + GREATEST(p_prompt_chars, 0),
      generate_retries = generate_retries + GREATEST(p_retries, 0),
      atualizado_em = now()
    WHERE usage_date = CURRENT_DATE;
  END IF;
END;
$$;

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
  IF p_kind NOT IN ('assistant', 'kit') OR p_daily_limit < 1 THEN
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
  ELSE
    UPDATE ai_usage_daily
      SET kit_calls = kit_calls + 1, atualizado_em = now()
      WHERE user_id = p_user_id AND usage_date = CURRENT_DATE
        AND kit_calls < p_daily_limit;
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
      atualizado_em = now()
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
$$;

CREATE OR REPLACE FUNCTION public.reserve_force_new(
  p_creator_id uuid,
  p_product_id uuid,
  p_cooldown_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO ai_force_new_cooldowns (creator_id, product_id, reserved_at)
  VALUES (p_creator_id, p_product_id, now())
  ON CONFLICT (creator_id, product_id) DO UPDATE
    SET reserved_at = EXCLUDED.reserved_at
    WHERE ai_force_new_cooldowns.reserved_at
      <= now() - make_interval(secs => p_cooldown_seconds);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_force_new(p_creator_id uuid, p_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM ai_force_new_cooldowns
  WHERE creator_id = p_creator_id AND product_id = p_product_id;
$$;

REVOKE ALL ON public.ai_usage_daily FROM anon, authenticated;
REVOKE ALL ON public.ai_force_new_cooldowns FROM anon, authenticated;
REVOKE ALL ON public.ai_metrics_daily FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_metrics(text, integer, integer, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_ai_quota(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_ai_quota(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_force_new(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_force_new(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_quota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_force_new(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_force_new(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_ai_metrics(text, integer, integer, integer, boolean) TO service_role;
