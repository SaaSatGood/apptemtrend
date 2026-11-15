/**
 * Tom de voz compartilhado entre onboarding e Minha conta.
 * Manter a mesma lista e o mesmo texto evita duas formas de pedir a mesma
 * coisa em telas diferentes.
 */
export const VOICE_TONES = ["Descontraído", "Direto", "Bem-humorado", "Técnico"] as const;

export type VoiceTone = (typeof VOICE_TONES)[number];

export function voiceToneSentence(tone: VoiceTone): string {
  return `Meu tom é ${tone.toLocaleLowerCase("pt-BR")}.`;
}

export function voiceToneFromText(text: string): VoiceTone | null {
  const normalized = text.toLocaleLowerCase("pt-BR");
  return VOICE_TONES.find((tone) => normalized.includes(tone.toLocaleLowerCase("pt-BR"))) ?? null;
}

/** Separa o tom escolhido do texto livre salvo em voz_exemplo. */
export function splitVoiceTone(text: string): { tone: VoiceTone | null; text: string } {
  const normalized = text.toLocaleLowerCase("pt-BR");
  for (const candidate of VOICE_TONES) {
    const sentence = voiceToneSentence(candidate);
    const index = normalized.indexOf(sentence.toLocaleLowerCase("pt-BR"));
    if (index === -1) continue;
    const rest = `${text.slice(0, index)} ${text.slice(index + sentence.length)}`;
    return { tone: candidate, text: rest.replace(/\s+/g, " ").trim() };
  }
  return { tone: null, text: text.trim() };
}

/** Junta o tom escolhido com a descrição livre no formato que a IA recebe. */
export function joinVoiceTone(text: string, tone: VoiceTone | null): string {
  return [tone ? voiceToneSentence(tone) : "", text.trim()].filter(Boolean).join(" ");
}

const EXAMPLES: Record<VoiceTone, (theme: string) => string> = {
  Descontraído: (theme) =>
    `Gente, preciso mostrar esse achado de ${theme} pra vocês. Testei por alguns dias e o resultado me surpreendeu de verdade. Vou mostrar sem filtro o que funcionou e o que não funcionou.`,
  Direto: (theme) =>
    `Testei este ${theme} por uma semana. Vou direto ao ponto: o que funciona, o que não funciona e para quem vale a pena. O resultado aparece no final.`,
  "Bem-humorado": (theme) =>
    `Eu ia fazer um vídeo sério sobre este ${theme}, mas aí ele me surpreendeu. Olha o antes e depois — e sim, eu já quero outro.`,
  Técnico: (theme) =>
    `Vou avaliar este ${theme} em três pontos: acabamento, praticidade e custo-benefício. Mostro o teste na prática e o resultado objetivo de cada um.`,
};

/** Exemplo curto e editável, no tom escolhido, para destravar o campo em branco. */
export function voiceExample(tone: VoiceTone = "Descontraído", theme?: string | null): string {
  const subject = (theme || "produto").toLocaleLowerCase("pt-BR");
  return EXAMPLES[tone](subject);
}
