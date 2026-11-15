"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, friendlyError } from "@/lib/api";
import type { CreatorContent } from "@/lib/types";
import { usePlatform } from "./store";

interface ScheduleEditorProps {
  content: CreatorContent;
  initialDate?: string;
  compact?: boolean;
  onSaved?: () => void;
}

export default function ScheduleEditor({ content, initialDate, compact = false, onSaved }: ScheduleEditorProps) {
  const { session, loadProductions, toast } = usePlatform();
  const [date, setDate] = useState(initialDate ?? content.scheduled_for ?? "");
  const [saving, setSaving] = useState(false);

  async function save(nextDate: string | null) {
    if (!session || saving) return;
    setSaving(true);
    try {
      await api(`/creator-content/${content.id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ scheduled_for: nextDate }),
      });
      await loadProductions();
      setDate(nextDate ?? "");
      toast(nextDate ? "Conteúdo agendado com sucesso." : "Agendamento removido.");
      onSaved?.();
    } catch (error) {
      toast(friendlyError(error, "Não foi possível salvar o agendamento."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`tt-schedule-editor${compact ? " is-compact" : ""}`}>
      <label htmlFor={`schedule-${content.id}`}>
        <Icon name="calendar" size={13} />
        <span>{content.scheduled_for ? "Data planejada" : "Agendar conteúdo"}</span>
      </label>
      <div className="tt-schedule-row">
        <input
          id={`schedule-${content.id}`}
          name={`schedule-${content.id}`}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label={`Data planejada para ${content.products?.nome ?? "conteúdo"}`}
        />
        <button type="button" disabled={!date || saving || date === content.scheduled_for} onClick={() => save(date)}>
          {saving ? "Salvando…" : content.scheduled_for ? "Atualizar" : "Agendar"}
        </button>
        {content.scheduled_for && (
          <button type="button" className="is-remove" disabled={saving} onClick={() => save(null)} aria-label="Remover agendamento">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
