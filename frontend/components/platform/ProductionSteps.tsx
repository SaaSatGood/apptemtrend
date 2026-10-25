import Icon from "@/components/ui/Icon";

const STEPS = ["Salvo", "Em produção", "Gravado", "Publicado"];

export default function ProductionSteps({ current }: { current: number }) {
  return <ol className="journey-steps" aria-label="Etapas da produção">{STEPS.map((label, index) => <li key={label} className={index + 1 < current ? "is-done" : index + 1 === current ? "is-current" : ""} aria-current={index + 1 === current ? "step" : undefined}><span aria-hidden="true">{index + 1 < current ? <Icon name="check" size={11} strokeWidth={2.3} /> : index + 1}</span>{label}</li>)}</ol>;
}
