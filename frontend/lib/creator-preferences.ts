import type { IconName } from "@/components/ui/Icon";

/**
 * Preferências que orientam a IA da TemTrend (objetivo, formato, nichos e
 * voz). Compartilhadas entre o onboarding e a tela de Preferências para que
 * as duas nunca ofereçam opções diferentes.
 */
export const OBJECTIVES: Array<{ value: string; label: string; detail: string; icon: IconName }> = [
  { value: "comecar_vender", label: "Quero começar a vender", detail: "Encontre um produto e dê o primeiro passo.", icon: "target" },
  { value: "vender_mais", label: "Já vendo e quero vender mais", detail: "Crie novas ideias para o seu catálogo.", icon: "trending-up" },
  { value: "criar_videos", label: "Quero criar vídeos para produtos", detail: "Transforme produtos em roteiros graváveis.", icon: "video" },
  { value: "explorando", label: "Estou só explorando", detail: "Conheça a plataforma no seu ritmo.", icon: "compass" },
];

export const STYLES: Array<{ value: string; detail: string; icon: IconName }> = [
  { value: "Mostrando produtos", detail: "Apresente produtos e destaque seus benefícios.", icon: "layers" },
  { value: "Reviews", detail: "Compartilhe opiniões e experiências.", icon: "message-square" },
  { value: "Falando para a câmera", detail: "Grave falando diretamente com o público.", icon: "video" },
  { value: "Unboxing", detail: "Mostre a abertura e os detalhes do produto.", icon: "box" },
  { value: "Tutorial", detail: "Ensine como utilizar o produto.", icon: "file-text" },
  { value: "Antes e depois", detail: "Mostre transformações e resultados.", icon: "refresh" },
  { value: "Outro", detail: "Descreva do seu jeito.", icon: "sparkles" },
];

/** Temas principais sempre visíveis no onboarding. */
export const THEMES = [
  "Beleza",
  "Casa",
  "Tecnologia",
  "Fitness",
  "Moda",
  "Lifestyle",
  "Gastronomia",
  "Outros",
];

/** Temas extras, revelados em "Ver mais" para não poluir a primeira leitura. */
export const EXTRA_THEMES = [
  "Pets",
  "Maternidade",
  "Games",
  "Educação",
  "Decoração",
  "Acessórios",
  "Organização",
  "Automotivo",
  "Infantil",
  "Esportes",
];

export const VOZ_MAX = 500;
export const THEMES_MAX = 3;
export const NICHO_MAX = 50;
export const OTHER_THEME = "Outros";
const OTHER_THEME_PREFIX = "Outros: ";

/** Junta os formatos escolhidos com o texto livre de "Outro". */
export function stylesPayload(estilos: string[], outro: string): string[] {
  const values = estilos.filter((value) => value !== "Outro");
  if (!estilos.includes("Outro")) return values;
  const custom = outro.trim().slice(0, 50);
  return [...values, custom ? `Outro: ${custom}` : "Outro"];
}

/** Remove o rótulo técnico e devolve o texto legível do tema. */
export function themeLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith(OTHER_THEME_PREFIX)) return trimmed.slice(OTHER_THEME_PREFIX.length).trim();
  return trimmed;
}

/** Junta os temas escolhidos com o nicho livre de "Outros". */
export function themesPayload(temas: string[], nicho: string): string[] {
  const values = temas.filter((value) => value !== OTHER_THEME);
  if (!temas.includes(OTHER_THEME)) return values;
  const custom = nicho.trim().replace(/\s+/g, " ").slice(0, NICHO_MAX);
  return [...values, custom ? `${OTHER_THEME_PREFIX}${custom}` : OTHER_THEME];
}

/** Separa os temas salvos do nicho personalizado usado em "Outros". */
export function splitSavedThemes(saved: string[] | null | undefined): { temas: string[]; nicho: string } {
  const temas: string[] = [];
  let nicho = "";
  for (const raw of saved || []) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    if (value.startsWith(OTHER_THEME_PREFIX)) {
      if (!nicho) nicho = value.slice(OTHER_THEME_PREFIX.length).trim();
      if (!temas.includes(OTHER_THEME)) temas.push(OTHER_THEME);
      continue;
    }
    if (value === OTHER_THEME) {
      if (!temas.includes(OTHER_THEME)) temas.push(OTHER_THEME);
      continue;
    }
    if ((THEMES.includes(value) || EXTRA_THEMES.includes(value)) && !temas.includes(value)) temas.push(value);
  }
  return { temas: temas.slice(0, THEMES_MAX), nicho };
}
