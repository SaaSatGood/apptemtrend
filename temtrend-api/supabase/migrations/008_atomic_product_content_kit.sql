-- Atomic admin creation for the single Product + Brand Kit workflow.
CREATE OR REPLACE FUNCTION public.create_product_with_content_kit(
  p_product JSONB,
  p_content_kit JSONB,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_content_kit public.content_kits;
BEGIN
  INSERT INTO public.products (
    nome, descricao, categoria, imagem_url, status, destaque, ordem_destaque, criado_por
  ) VALUES (
    p_product->>'nome',
    NULLIF(p_product->>'descricao', ''),
    NULLIF(p_product->>'categoria', ''),
    NULLIF(p_product->>'imagem_url', ''),
    COALESCE(NULLIF(p_product->>'status', ''), 'ativo'),
    COALESCE((p_product->>'destaque')::boolean, false),
    COALESCE((p_product->>'ordem_destaque')::integer, 0),
    p_created_by
  ) RETURNING * INTO v_product;

  INSERT INTO public.content_kits (
    product_id, titulo, descricao, formato, plataforma, nivel_dificuldade,
    hook, roteiro, cenas, copy, cta, hashtags, audio_sugerido, duracao_seg
  ) VALUES (
    v_product.id,
    p_content_kit->>'titulo',
    NULLIF(p_content_kit->>'descricao', ''),
    NULLIF(p_content_kit->>'formato', ''),
    NULLIF(p_content_kit->>'plataforma', ''),
    NULLIF(p_content_kit->>'nivel_dificuldade', ''),
    NULLIF(p_content_kit->>'hook', ''),
    NULLIF(p_content_kit->>'roteiro', ''),
    p_content_kit->'cenas',
    NULLIF(p_content_kit->>'copy', ''),
    NULLIF(p_content_kit->>'cta', ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_content_kit->'hashtags', '[]'::jsonb))), '{}'),
    NULLIF(p_content_kit->>'audio_sugerido', ''),
    NULLIF(p_content_kit->>'duracao_seg', '')::integer
  ) RETURNING * INTO v_content_kit;

  RETURN jsonb_build_object('product', to_jsonb(v_product), 'content_kit', to_jsonb(v_content_kit));
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_with_content_kit(JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_with_content_kit(JSONB, JSONB, UUID) TO service_role;
