"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { fullProductName } from "@/lib/format";
import { usePlatform } from "./store";
import type { CreatorContent } from "@/lib/types";
import ScheduleEditor from "./ScheduleEditor";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  salvo: { bg: "rgba(100, 116, 139, 0.2)", text: "var(--tt-app-muted)", label: "Salvo" },
  em_producao: { bg: "rgba(200, 255, 46, 0.2)", text: "#9dc81e", label: "Gravar" },
  gravado: { bg: "rgba(245, 158, 11, 0.2)", text: "#f59e0b", label: "Editar" },
  publicado: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e", label: "No ar" },
};

export default function CalendarView() {
  const { productions } = usePlatform();
  const [view, setView] = useState<{ date: Date; day: number | null } | null>(null);

  // A "próxima semana" pode começar no mês seguinte. Se já há conteúdo
  // planejado nela, abrir no mês atual esconderia parte do plano (ex.: planejar
  // novembro em 27 de outubro). Nesse caso, abrimos no mês da semana planejada;
  // o botão "Hoje" continua trazendo o usuário de volta. A visão inicial é
  // derivada das produções e só é usada até o usuário navegar.
  const initialView = useMemo(() => {
    const today = new Date();
    const offset = (8 - today.getDay()) % 7;
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const todayView = {
      date: new Date(today.getFullYear(), today.getMonth(), 1),
      day: today.getDate(),
    };
    if (weekStart.getMonth() === today.getMonth() || !productions.length) return todayView;
    const weekKeys = new Set(
      Array.from({ length: 7 }, (_, index) =>
        toLocalDateKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index))
      )
    );
    if (!productions.some((item) => item.scheduled_for && weekKeys.has(item.scheduled_for))) {
      return todayView;
    }
    return {
      date: new Date(weekStart.getFullYear(), weekStart.getMonth(), 1),
      day: weekStart.getDate(),
    };
  }, [productions]);

  const currentDate = view?.date ?? initialView.date;
  const selectedDay = view ? view.day : initialView.day;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Dias do mês
  const calendarGrid = useMemo(() => {
    const daysInCurrMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const grid: Array<{ day: number; isCurrentMonth: boolean; dateKey: string }> = [];

    // Dias do mês anterior para preencher a primeira semana
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      grid.push({
        day: d,
        isCurrentMonth: false,
        dateKey: toLocalDateKey(prevDate),
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInCurrMonth; d++) {
      const currDate = new Date(year, month, d);
      grid.push({
        day: d,
        isCurrentMonth: true,
        dateKey: toLocalDateKey(currDate),
      });
    }

    // Exibir também a semana seguinte quando o mês termina no sábado.
    // Assim um plano de sete dias na virada do mês permanece visível.
    const remainder = grid.length % 7;
    const needed = remainder === 0 ? 7 : 7 - remainder;
    for (let d = 1; d <= needed; d++) {
      const nextDate = new Date(year, month + 1, d);
      grid.push({
        day: d,
        isCurrentMonth: false,
        dateKey: toLocalDateKey(nextDate),
      });
    }

    return grid;
  }, [year, month]);

  // Agrupamento de conteúdos por data
  const contentsByDate = useMemo(() => {
    const map = new Map<string, CreatorContent[]>();
    productions.forEach((item: CreatorContent) => {
      if (!item.scheduled_for) return;
      const dateKey = item.scheduled_for;

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(item);
    });
    return map;
  }, [productions]);

  function prevMonth() {
    setView((current) => {
      const base = current?.date ?? initialView.date;
      return { date: new Date(base.getFullYear(), base.getMonth() - 1, 1), day: null };
    });
  }

  function nextMonth() {
    setView((current) => {
      const base = current?.date ?? initialView.date;
      return { date: new Date(base.getFullYear(), base.getMonth() + 1, 1), day: null };
    });
  }

  function goToToday() {
    const now = new Date();
    setView({ date: new Date(now.getFullYear(), now.getMonth(), 1), day: now.getDate() });
  }

  function selectDate(key: string) {
    const [selectedYear, selectedMonth, day] = key.split("-").map(Number);
    setView({ date: new Date(selectedYear, selectedMonth - 1, 1), day });
  }

  const selectedDateKey = useMemo(() => {
    if (!selectedDay) return null;
    const date = new Date(year, month, selectedDay);
    return toLocalDateKey(date);
  }, [year, month, selectedDay]);

  const selectedDayContents = selectedDateKey ? contentsByDate.get(selectedDateKey) || [] : [];

  const today = new Date();
  const nextMondayOffset = (8 - today.getDay()) % 7;
  const nextSevenDays = Array.from({ length: 7 }, (_, index) =>
    toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + nextMondayOffset + index))
  );
  const plannedDays = nextSevenDays.filter((key) => (contentsByDate.get(key)?.length ?? 0) > 0).length;

  return (
    <div className="tt-calendar-page">
      {/* Cabeçalho */}
      <header className="tt-calendar-header">
        <div className="tt-calendar-header-copy">
          <span className="tt-badge-chip">Visão editorial</span>
          <h1>Calendário de <span className="tt-hl">conteúdo</span></h1>
          <p>
            Planeje gravações e publicações, com cada conteúdo na data que você escolheu.
          </p>
        </div>
        <div className="tt-calendar-controls">
          <button type="button" className="tt-btn-outline" onClick={goToToday}>
            Hoje
          </button>
          <div className="tt-month-nav">
            <button type="button" onClick={prevMonth} aria-label="Mês anterior">
              <Icon name="arrow-left" size={16} />
            </button>
            <span className="tt-month-title">
              {MONTH_NAMES[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} aria-label="Próximo mês">
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Meta da semana */}
      <div className="tt-calendar-goal-banner">
        <div className="tt-goal-info">
          <span className="tt-goal-pill">Ritmo de publicação</span>
          <strong>Planeje os próximos sete dias</strong>
          <small>Escolha produtos, prepare roteiros e ajuste a data de cada conteúdo.</small>
        </div>
        <div className="tt-goal-progress">
          <div className="tt-goal-stat">
            <span>Próxima semana</span>
            <b>{plannedDays} de 7 planejados</b>
          </div>
          <Link href="/descobrir?plan=week" className="tt-btn-lime">
            <Icon name="calendar" size={14} />
            <span>Planejar semana</span>
          </Link>
        </div>
      </div>

      <div className="tt-calendar-layout">
        {/* Grade do Calendário */}
        <div className="tt-calendar-main">
          <div className="tt-calendar-weekdays">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="tt-calendar-weekday">
                {wd}
              </div>
            ))}
          </div>

          <div className="tt-calendar-grid">
            {calendarGrid.map((item, idx) => {
              const items = contentsByDate.get(item.dateKey) || [];
              const isToday = item.dateKey === toLocalDateKey(today);
              const isSelected = item.dateKey === selectedDateKey;
              const itemMonth = new Date(`${item.dateKey}T12:00:00`).getMonth();

              return (
                <div
                  key={`${item.dateKey}-${idx}`}
                  className={`tt-calendar-cell${!item.isCurrentMonth ? " is-other-month" : ""}${
                    isToday ? " is-today" : ""
                  }${isSelected ? " is-selected" : ""}`}
                  onClick={() => selectDate(item.dateKey)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    selectDate(item.dateKey);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.day} de ${MONTH_NAMES[itemMonth]}, ${items.length} ${items.length === 1 ? "conteúdo" : "conteúdos"}${isSelected ? ", selecionado" : ""}`}
                >
                  <div className="tt-cell-header">
                    <span className="tt-day-number">{item.day}</span>
                    {isToday && <span className="tt-today-badge">Hoje</span>}
                  </div>

                  <div className="tt-cell-items">
                    {items.slice(0, 3).map((content) => {
                      const color = STATUS_COLOR[content.status] || STATUS_COLOR.salvo;
                      const title = fullProductName(content.products ?? null);
                      return (
                        <div
                          key={content.id}
                          className="tt-calendar-item-badge"
                          style={{ backgroundColor: color.bg, color: color.text }}
                          title={`${title} (${color.label})`}
                        >
                          <span className="tt-badge-dot" style={{ backgroundColor: color.text }} />
                          <span className="tt-badge-text">{title}</span>
                        </div>
                      );
                    })}
                    {items.length > 3 && (
                      <span className="tt-more-items">+{items.length - 3} mais</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel lateral do dia selecionado */}
        <aside className="tt-calendar-sidebar-panel">
          <div className="tt-panel-head">
            <div>
              <h3>
                {selectedDay ? `${selectedDay} de ${MONTH_NAMES[month]}` : "Selecione um dia"}
              </h3>
              <p>
                {selectedDayContents.length === 1
                  ? "1 conteúdo agendado"
                  : `${selectedDayContents.length} conteúdos agendados`}
              </p>
            </div>
            {selectedDay && (
              <Link href="/conteudos" className="tt-btn-icon" title="Agendar conteúdo">
                <Icon name="plus" size={16} />
              </Link>
            )}
          </div>

          <div className="tt-panel-body">
            {selectedDayContents.length === 0 ? (
              <div className="tt-day-empty">
                <Icon name="calendar" size={28} />
                <p>Nenhum conteúdo planejado para este dia.</p>
                <Link href="/conteudos" className="tt-btn-sm-outline">
                  Agendar na biblioteca
                </Link>
              </div>
            ) : (
              <div className="tt-day-items-list">
                {selectedDayContents.map((content) => {
                  const color = STATUS_COLOR[content.status] || STATUS_COLOR.salvo;
                  const name = fullProductName(content.products ?? null);
                  const kit = content.content_kits;
                  const priceText = content.products?.preco_texto || null;

                  return (
                    <div key={content.id} className="tt-day-card">
                      <div className="tt-day-card-header">
                        <span
                          className="tt-day-status-pill"
                          style={{ backgroundColor: color.bg, color: color.text }}
                        >
                          {color.label}
                        </span>
                        {priceText && (
                          <span className="tt-day-commission">
                            {priceText}
                          </span>
                        )}
                      </div>
                      <h4 className="tt-day-product-title">{name}</h4>
                      {kit?.hook && <p className="tt-day-hook">“{kit.hook}”</p>}
                      <ScheduleEditor key={`${content.id}-${selectedDateKey}`} content={content} initialDate={selectedDateKey ?? undefined} compact />
                      <div className="tt-day-card-actions">
                        {kit?.id ? (
                          <Link
                            href={`/produtos/${content.product_id}/kits/${kit.id}`}
                            className="tt-link-btn"
                          >
                            <Icon name="file-text" size={13} />
                            <span>Roteiro</span>
                          </Link>
                        ) : null}
                        <Link
                          href={`/producao?item=${content.id}`}
                          className="tt-link-btn is-highlight"
                        >
                          <Icon name="production" size={13} />
                          <span>Gravar</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
