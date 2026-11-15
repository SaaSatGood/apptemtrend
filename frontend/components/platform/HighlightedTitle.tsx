const TRAILING_PUNCTUATION = /[.,!?;:…]+$/;

/**
 * Destaca uma palavra do título com o realce lime da marca.
 * Sem `word`, destaca a última palavra (com a pontuação final).
 *
 * O retorno fica dentro de `.tt-title`: títulos com `display: flex`
 * (hero do Descobrir) tratam cada nó como um item, e sem o wrapper a
 * frase quebrava em linhas separadas.
 */
export default function HighlightedTitle({ text, word }: { text: string; word?: string }) {
  const title = text.replace(/\s+/g, " ").trim();
  if (!title) return null;

  const target = word?.trim();
  let index = -1;
  let length = 0;

  if (target) {
    index = title.toLocaleLowerCase("pt-BR").lastIndexOf(target.toLocaleLowerCase("pt-BR"));
    length = target.length;
  } else {
    const withoutPunctuation = title.replace(TRAILING_PUNCTUATION, "");
    const lastSpace = withoutPunctuation.lastIndexOf(" ");
    index = lastSpace + 1;
    length = title.length - index;
  }

  if (index < 0 || length <= 0) return <span className="tt-title">{title}</span>;

  const end = index + length;
  return (
    <span className="tt-title">
      {title.slice(0, index)}
      <span className="tt-hl">{title.slice(index, end)}</span>
      {title.slice(end)}
    </span>
  );
}
