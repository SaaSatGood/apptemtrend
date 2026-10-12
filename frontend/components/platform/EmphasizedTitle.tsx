export default function EmphasizedTitle({ text }: { text: string }) {
  const lastSpace = text.lastIndexOf(" ");
  if (lastSpace < 0) return <em>{text}</em>;
  return <>{text.slice(0, lastSpace)} <em>{text.slice(lastSpace + 1)}</em></>;
}
