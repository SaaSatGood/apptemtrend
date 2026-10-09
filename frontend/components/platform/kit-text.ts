import { normalizeScenes, type Scene } from "@/lib/format";

function sceneCopyText(scene: Scene | string, index: number): string {
  const parts =
    typeof scene === "string"
      ? { show: scene, say: "", time: "", edit: "" }
      : sceneParts(scene);
  return [
    `CENA ${String(index + 1).padStart(2, "0")}${parts.time ? ` · ${parts.time}` : ""}`,
    parts.show ? `MOSTRE:\n${parts.show}` : "",
    parts.say ? `FALE:\n${parts.say}` : "",
    parts.edit ? `AÇÃO / EDIÇÃO:\n${parts.edit}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function sceneParts(scene: Scene): { show: string; say: string; time: string; edit: string } {
  const s = scene as unknown as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  return {
    show: str(s.mostre || s.visual || s.acao || s["ação"] || s.descricao || s["descrição"] || s.cena || s.title || s.titulo),
    say: str(s.fale || s.fala || s.texto || s.script || s.narracao || s["narração"] || s.roteiro),
    time: str(s.tempo || s.time || s.duracao || s["duração"]),
    edit: str(s.acao_edicao || s.acaoEdicao || s.edicao || s["edição"]),
  };
}

export function kitCopyText(kit: {
  titulo: string;
  descricao?: string | null;
  hook?: string | null;
  cenas?: unknown;
  roteiro?: string | null;
  copy?: string | null;
  cta?: string | null;
  hashtags?: string[] | null;
  audio_sugerido?: string | null;
  duracao_seg?: number | null;
}): string {
  const scenes = normalizeScenes(kit.cenas)
    .map((s: Scene | string, i: number) => sceneCopyText(s, i))
    .join("\n\n");
  const rows: Array<[string, unknown]> = [
    ["CONCEITO", kit.descricao],
    ["HOOK", kit.hook],
    ["CENAS", scenes],
    ["ROTEIRO", kit.roteiro],
    ["COPY", kit.copy],
    ["CTA", kit.cta],
    ["HASHTAGS", (kit.hashtags || []).map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")],
    ["ÁUDIO", kit.audio_sugerido],
    ["DURAÇÃO", kit.duracao_seg ? `${kit.duracao_seg}s` : null],
  ];
  return [`CONTENT KIT — ${kit.titulo}`]
    .concat(rows.filter(([, v]) => v).map(([label, value]) => `${label}\n${value}`))
    .join("\n\n");
}
