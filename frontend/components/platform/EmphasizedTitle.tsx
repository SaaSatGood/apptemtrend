const STOP_WORDS = /^(?:de|do|da|dos|das|em|com|para|por|e)$/i;

/**
 * Títulos de produto: destaca a última palavra com o realce padrão da marca.
 * Usado no detalhe do produto e no modo de gravação.
 */
export default function EmphasizedTitle({ text }: { text: string }) {
  const title = text.replace(/\s+/g, " ").trim();
  const lastSpace = title.lastIndexOf(" ");
  if (lastSpace < 0) return <span className="tt-title"><span className="tt-hl">{title}</span></span>;
  const lastWord = title.slice(lastSpace + 1);
  if (STOP_WORDS.test(lastWord)) return <span className="tt-title">{title}</span>;
  return (
    <span className="tt-title">
      {title.slice(0, lastSpace)} <span className="tt-hl">{lastWord}</span>
    </span>
  );
}
