import type { CreatorContent } from "@/lib/types";

/** Encontra a produção vinculada a um produto (por id direto ou aninhado). */
export function productionForProduct(
  productions: CreatorContent[],
  productId: string
): CreatorContent | null {
  return (
    productions.find((item) => item.product_id === productId || item.products?.id === productId) ||
    null
  );
}
