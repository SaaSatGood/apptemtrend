export default function EmphasizedTitle({ text }: { text: string }) {
  const title = text.replace(/\s+/g, " ").trim();
  const lastSpace = title.lastIndexOf(" ");
  if (lastSpace < 0) return <em>{title}</em>;
  const lastWord = title.slice(lastSpace + 1);
  if (/^(?:de|do|da|dos|das|em|com|para|por|e)$/i.test(lastWord)) return <>{title}</>;
  return <>{title.slice(0, lastSpace)} <em>{lastWord}</em></>;
}
