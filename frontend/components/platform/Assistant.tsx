"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import { resolveSession } from "@/lib/supabase";
import { api, friendlyError, type ApiError } from "@/lib/api";
import { track } from "@/lib/track";
import { loadProductDetail, peekProductDetail, primeProductDetail } from "@/lib/product-detail-cache";
import { hasPaidPlan } from "@/lib/plan-access";
import { fetchDiscoverySession, peekDiscoverySession, rememberDiscoverySession } from "@/lib/discovery-session-cache";
import { copyText, displayProductName } from "@/lib/format";
import { sessionTitleFromQuery } from "@/lib/session-title";
import { notifySessionsChanged } from "@/lib/session-events";
import { notifyPlanUsageChanged } from "@/lib/usage-events";
import { kitCopyText } from "./kit-text";
import type { AssistantResponse, BillingSubscriptionSummary, ContentKit, CreatorContent, DiscoverySearch, DiscoverySearchSummary, DiscoverySession, DiscoverySessionSummary, Product, SharedTurn } from "@/lib/types";
import { usePlatform } from "./store";
import { productionForProduct } from "./production-helpers";
import ProductImage from "./ProductImage";
import HighlightedTitle from "./HighlightedTitle";
import UpgradeDialog from "./UpgradeDialog";
import Modal from "./Modal";
import { SearchHistoryDialog } from "./DiscoveryHistory";

// Diálogo carregado sob demanda: fora do bundle inicial do Descobrir.
const WeeklyPlanner = dynamic(() => import("./WeeklyPlanner"), { loading: () => null });
const FILTER_GROUPS = [
  {
    label: "Preço",
    icon: "percent",
    options: [
      ["Até R$ 50", "Quero produtos com preço de até 50 reais"],
      ["Até R$ 100", "Quero produtos com preço de até 100 reais"],
    ],
  },
  {
    label: "Nicho",
    icon: "grid",
    options: [
      ["Casa", "Quero vender produtos para casa"],
      ["Beleza", "Quero vender produtos de beleza"],
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  icon: IconName;
  options: ReadonlyArray<readonly [string, string]>;
}>;

type FilterGroupLabel = (typeof FILTER_GROUPS)[number]["label"];

type AssistantContext = "discover" | "create" | "surprise" | "week";
const ASSISTANT_TABS: AssistantContext[] = ["discover", "surprise", "week"];
const SURPRISE_PROMPT = "Não sei o que vender. Sugira oportunidades do catálogo para começar a criar conteúdo.";
// Mesmo composer no palco inicial e no rodapé da conversa.
const COMPOSER_PLACEHOLDER = "Diga o que você quer vender ou escolha uma opção abaixo";
type ImageAttachment = { name: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string; previewUrl: string };
type PastTurn = {
  id: number;
  query: string;
  message: string;
  products: Product[];
  needsClarification: boolean;
  imageName: string | null;
  /** Posição do turno no histórico salvo (para apagar a mensagem certa). */
  index?: number;
};
const MAX_PAST_TURNS = 8;

const ASSISTANT_CONTEXTS: Record<AssistantContext, {
  label: string;
  hint: string;
  title: string;
  description: string;
  fieldLabel: string;
  submit: string;
}> = {
  discover: {
    label: "Descobrir produtos",
    hint: "Buscar no catálogo",
    title: "Encontre a próxima oportunidade.",
    description: "Converse com a TemTrend, compare produtos reais e decida o que vale transformar em vídeo.",
    fieldLabel: "O que você quer vender?",
    submit: "Encontrar produtos",
  },
  create: {
    label: "Criar conteúdo",
    hint: "Roteiro a partir de uma ideia",
    title: "Sua ideia vira roteiro.",
    description: "Descreva o vídeo que você quer criar. Encontramos o produto certo e abrimos a criação do conteúdo.",
    fieldLabel: "Qual conteúdo você quer criar?",
    submit: "Escolher produto",
  },
  surprise: {
    label: "Não sei o que vender",
    hint: "Sugestões do catálogo",
    title: "Deixe a escolha com a gente.",
    description: "Sem produto em mente? Mostramos oportunidades reais do catálogo para você começar hoje.",
    fieldLabel: "Quer dar uma direção? (opcional)",
    submit: "Me surpreenda",
  },
  week: {
    label: "Planejar a semana",
    hint: "Sete dias de conteúdo",
    title: "Prepare sete dias de conteúdo.",
    description: "Conte o nicho ou objetivo da semana. A TemTrend escolhe os produtos e prepara roteiros, legendas e hashtags.",
    fieldLabel: "Qual é o foco desta semana?",
    submit: "Preparar minha semana",
  },
};

const CONTEXT_ICON = { discover: "compass", create: "video", surprise: "sparkles", week: "calendar" } as const;

// O objetivo escolhido no onboarding muda a primeira tela do Descobrir.
// Sem isso, a pessoa sente que respondeu à configuração à toa.
const DISCOVER_BY_OBJECTIVE: Record<string, { title: string; description: string; fieldLabel: string }> = {
  comecar_vender: {
    title: "Encontre seu primeiro produto.",
    description: "Comece por produtos reais do catálogo, com preço, vendas e comissão à vista.",
    fieldLabel: "O que você quer vender?",
  },
  vender_mais: {
    title: "Sua próxima oportunidade.",
    description: "Compare produtos e encontre um ângulo novo para ampliar o seu catálogo.",
    fieldLabel: "O que você quer vender mais?",
  },
  criar_videos: {
    title: "Sua ideia vira roteiro.",
    description: "Escolha um produto e transforme a ideia em um roteiro gravável.",
    fieldLabel: "Qual produto vai virar vídeo?",
  },
  explorando: {
    title: "Explore sem compromisso.",
    description: "Veja produtos reais e entenda como a TemTrend transforma catálogo em conteúdo.",
    fieldLabel: "Quer explorar qual tema?",
  },
};

async function prepareImageAttachment(file: File): Promise<ImageAttachment> {
  if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
    throw new Error("Envie uma imagem JPEG, PNG ou WEBP.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar esta imagem.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .76));
  if (blob && blob.size > 620_000) {
    const reduced = document.createElement("canvas");
    const factor = Math.min(.8, Math.sqrt(620_000 / blob.size));
    reduced.width = Math.max(1, Math.round(canvas.width * factor));
    reduced.height = Math.max(1, Math.round(canvas.height * factor));
    reduced.getContext("2d")?.drawImage(canvas, 0, 0, reduced.width, reduced.height);
    blob = await new Promise<Blob | null>((resolve) => reduced.toBlob(resolve, "image/jpeg", .68));
  }
  if (!blob) throw new Error("Não foi possível preparar esta imagem.");
  if (blob.size > 650_000) throw new Error("A imagem ficou grande demais. Escolha uma versão menor.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
    reader.readAsDataURL(blob);
  });
  return { name: file.name, mimeType: "image/jpeg", data: dataUrl.split(",")[1] || "", previewUrl: URL.createObjectURL(blob) };
}

/** Nome da conversa na sidebar: a intenção da pergunta, sem saudação nem corte no meio da palavra. */
function conversationTitle(query: string): string {
  return sessionTitleFromQuery(query);
}

const DISCOVERY_STATE_KEY = "temtrend_discovery_state";
const DISCOVERY_STATE_TTL = 2 * 60 * 60 * 1000;
type WeeklyItem = { product: Product; date: string; kit?: ContentKit; error?: string };
function weekDate(index: number) {
  const now = new Date();
  const mondayOffset = (8 - now.getDay()) % 7;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + index);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function salesOf(product: Product): number {
  return product.unidades_vendidas_total ?? product.unidades_vendidas_periodo ?? -1;
}

function commissionOf(product: Product): number | null {
  const referencePrice = product.preco_min_brl ?? product.preco_max_brl;
  return referencePrice != null && product.comissao_percentual != null
    ? referencePrice * product.comissao_percentual / 100
    : null;
}

function isSensitive(product: Product): boolean {
  return /lingerie|camisola|moda íntima|moda intima|roupa íntima|roupa intima|adulto/i.test(`${product.categoria || ""} ${product.nome}`);
}

/**
 * Destaca o produto mais forte do grupo, e só faz sentido quando há comparação:
 * com um único resultado o selo viraria uma promessa sem alternativa.
 */
function highlightFor(products: Product[]): { id: string; label: string } | null {
  if (products.length < 2) return null;
  const commissions = products
    .map((product) => ({ id: product.id, value: commissionOf(product) }))
    .filter((item): item is { id: string; value: number } => item.value !== null);
  if (commissions.length >= 2) {
    return {
      id: commissions.reduce((best, item) => (item.value > best.value ? item : best)).id,
      label: "Maior comissão estimada",
    };
  }
  const sales = products.filter((product) => salesOf(product) >= 0);
  if (sales.length >= 2) {
    return {
      id: sales.reduce((best, product) => (salesOf(product) > salesOf(best) ? product : best)).id,
      label: "Mais vendido do grupo",
    };
  }
  return null;
}

/** Guarda a última busca fora do escopo de render (o carimbo de tempo é impuro). */
function saveDiscoveryState(storageKey: string, snapshot: {
  query: string;
  message: string;
  results: Product[];
  needsClarification: boolean;
  contextIds: string[];
  pastTurns?: PastTurn[];
  imageName?: string | null;
  turnQuery?: string;
}) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), ...snapshot }));
  } catch { /* Storage is optional. */ }
}

function videoReason(reason?: string | null): string | null {
  if (!reason) return null;
  // TODO: pedir ao serviço uma justificativa própria para vídeo, sem repetir métricas do card.
  const cleaned = reason.split(" · ").filter((part) => !/preço acessível|comissão de|\d[\d.]* vendidos/i.test(part)).join(" · ").trim();
  return cleaned && !/^(selecionado para a sua busca|combina com sua busca)$/i.test(cleaned) ? cleaned : null;
}

export function ProductCard({
  product,
  position,
  saved,
  saving,
  highlightLabel,
  onOpen,
  onSave,
  onRemove,
  onGenerate,
  onPrefetch,
  compared = false,
  onCompare,
  generateLabel = "Gravar conteúdo",
  busy = false,
  busyLabel = "Abrindo gravação…",
}: {
  product: Product;
  position?: number;
  saved: boolean;
  saving: boolean;
  highlightLabel?: string;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  onRemove?: (id: string) => void;
  onGenerate: (id: string) => void;
  onPrefetch?: (id: string) => void;
  compared?: boolean;
  onCompare?: (id: string) => void;
  generateLabel?: string;
  busy?: boolean;
  busyLabel?: string;
}) {
  const name = displayProductName(product);
  const sold = salesOf(product);
  return (
    <article
      className={`product-card opportunity-card tone-${((position ?? 1) - 1) % 4 + 1}${highlightLabel ? " is-featured" : ""}${compared ? " is-compared" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes de ${name}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        onPrefetch?.(product.id);
        onOpen(product.id);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onPrefetch?.(product.id);
        onOpen(product.id);
      }}
    >
      <div className="product-image-wrap">
        <ProductImage product={product} className="product-image" />
        {position != null && <span className="product-rank" aria-hidden="true">{position}</span>}
      </div>
      <div className="product-body">
        <div className="opportunity-topline">
          {highlightLabel && <span className="opportunity-highlight">{highlightLabel}</span>}
          <span className="product-category">{product.categoria || "Produto"}</span>
        </div>
        <h3 title={product.nome}>{name}</h3>
        {isSensitive(product) && <p className="opportunity-sensitive">Pode ter restrição de anúncio ou criativo no TikTok.</p>}
        <dl className="opportunity-price">
          <div className="metric-price"><dt>Preço</dt><dd>{product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "Não informado")}</dd></div>
          {product.comissao_percentual != null && <div className="metric-commission"><dt>Comissão estimada</dt><dd>{product.comissao_percentual}% de comissão</dd></div>}
          {sold >= 0 && <div className="metric-sales"><dt>Vendas</dt><dd>{sold.toLocaleString("pt-BR")} vendas</dd></div>}
        </dl>
        {videoReason(product.motivo) && (
          <p className="opportunity-motivo">
            <Icon name="sparkles" size={14} />
            <span>{videoReason(product.motivo)}</span>
          </p>
        )}
        {commissionOf(product) != null && (
          <div className="opportunity-per-sale">
            <Icon name="percent" size={13} />
            <span>~ {BRL.format(commissionOf(product)!)} por venda</span>
          </div>
        )}
      </div>
      <div className="product-actions">
        <button className="generate-script" type="button" disabled={busy} aria-label={`${generateLabel} para ${name}`} onClick={() => onGenerate(product.id)}>{busy ? busyLabel : generateLabel}<Icon name={busy ? "refresh" : "arrow-right"} size={16} className={busy ? "is-spinning" : undefined} /></button>
        <div className="product-actions-secondary">
          <div className="opportunity-card-tools">
            {onCompare && (
              <button
                type="button"
                className="opportunity-compare-toggle"
                aria-pressed={compared}
                aria-label={compared ? `Remover ${name} da comparação` : `Comparar ${name}`}
                onClick={() => onCompare(product.id)}
              >
                {compared ? "Comparando" : "Comparar"}
              </button>
            )}
            <button
              type="button"
              className={`opportunity-save${saved ? " is-saved" : ""}`}
              disabled={saving}
              aria-label={saved ? `Remover ${name} dos salvos` : `Salvar ${name}`}
              title={saved ? "Remover dos salvos" : "Salvar produto"}
              onClick={() => (saved && onRemove ? onRemove(product.id) : onSave(product.id))}
            ><Icon name={saved ? "check" : "bookmark"} size={17} /></button>
          </div>
        </div>
      </div>
    </article>
  );
}

function AnimatedMessage({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return (
    <p className="chat-message">
      {words.map((word, index) => (
        <span
          key={`${index}-${word}`}
          className="chat-word"
          style={{ animationDelay: `${Math.min(index, 60) * 22}ms` }}
        >
          {word}{index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

/** Altura automática do campo, limitada a 5 linhas. */
function autoGrow(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, 22 * 5 + 18)}px`;
}

function ChatThinking({ label }: { label: string }) {
  return (
    <p className="chat-thinking" role="status">
      <span className="chat-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{label}</span>
    </p>
  );
}

// useLayoutEffect no cliente (roda antes do paint), useEffect no servidor.
const useSafeLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Troca entre o palco inicial e a conversa sem corte: o composer do hero é o
 * mesmo objeto do composer do rodapé, e a View Transitions API anima a
 * passagem de um estado para o outro. Sem suporte no navegador — ou com
 * movimento reduzido — a troca continua instantânea, como antes.
 */
async function withDiscoveryTransition(update: () => void) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof document.startViewTransition !== "function" || reduceMotion) {
    update();
    return;
  }
  let settle = () => {};
  const applied = new Promise<void>((resolve) => { settle = resolve; });
  try {
    const transition = document.startViewTransition(() => {
      try {
        flushSync(update);
      } finally {
        settle();
      }
    });
    // Uma navegação pode interromper a animação; o estado já foi aplicado.
    transition.finished.catch(() => {});
    await applied;
  } catch {
    // Falha da API é visual: o envio precisa seguir de qualquer forma.
    update();
    settle();
  }
}

export default function Assistant({ sessionId }: { sessionId?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const landingSearch = params.get("search");
  // Clique em "Descobrir" na sidebar: sempre a tela inicial do Descobrir.
  const novaChat = Boolean(params.get("nova"));
  const { toast, productions, me, loadProductions, session } = usePlatform();
  function prefetchProduct(id: string) {
    if (session?.access_token && !peekProductDetail(id)) {
      void loadProductDetail(id, session.access_token).catch(() => {});
    }
  }
  const [query, setQuery] = useState(() => (landingSearch || "").slice(0, 500));

  // A navegação pós-onboarding pode chegar depois de o componente montar
  // (o /me atualiza primeiro e só então o router aplica ?search=...). Sem
  // isso, o campo abriria vazio. Só preenche quando o campo está vazio e
  // nunca reaplica enquanto o usuário edita.
  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza ?search= aplicado depois do /me pós-onboarding */
  useEffect(() => {
    if (!landingSearch) return;
    setQuery((current) => current || landingSearch.slice(0, 500));
  }, [landingSearch]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [assistantContext, setAssistantContext] = useState<AssistantContext>(() => {
    const requested = params.get("context");
    if (requested === "create" || requested === "surprise" || requested === "week") return requested;
    return params.get("plan") === "week" ? "week" : "discover";
  });
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [imageContext, setImageContext] = useState("");
  const [openFilter, setOpenFilter] = useState<FilterGroupLabel | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [error, setError] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [recordingProductId, setRecordingProductId] = useState<string | null>(null);
  // "Detalhes" abre o produto dentro do próprio chat, sem trocar de página.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [weeklyPlannerOpen, setWeeklyPlannerOpen] = useState(() => params.get("plan") === "week");
  const [weeklyItems, setWeeklyItems] = useState<WeeklyItem[]>([]);
  const [weeklyProgress, setWeeklyProgress] = useState("");
  const [weeklyLimit, setWeeklyLimit] = useState(false);
  const [planLimitMessage, setPlanLimitMessage] = useState("");
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [hideSensitive, setHideSensitive] = useState(false);
  const [sortBy] = useState<"vendas" | "preco" | "comissao">("vendas");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [pastTurns, setPastTurns] = useState<PastTurn[]>([]);
  const detailsProduct = detailsId
    ? [...results, ...pastTurns.flatMap((turn) => turn.products)].find((product) => product.id === detailsId) ?? null
    : null;
  const [revealedCount, setRevealedCount] = useState(0);
  const [turnQuery, setTurnQuery] = useState("");
  const [turnImage, setTurnImage] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<DiscoverySearchSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusyId, setHistoryBusyId] = useState<string | null>(null);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const historyRequestId = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const hasPendingSearch = useRef(false);
  const inFlight = useRef(false);
  const scrollAfterSearch = useRef<"always" | "if-hidden" | false>(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLElement>(null);
  const turnSeq = useRef(0);
  // Último texto enviado: o campo limpa ao enviar, e "Tentar novamente" usa este.
  const lastSentQuery = useRef("");
  // Mesmo depois de o composer esvaziar, o anexo enviado fica guardado para o retry.
  const lastSentAttachment = useRef<ImageAttachment | null>(null);
  const storageKey = `${DISCOVERY_STATE_KEY}:${me?.user_id}`;
  const themeShortcuts = (me?.creator?.temas_interesse || [])
    .map((theme) => theme.replace(/^Outros:\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  // Catálogo e vitrines são recursos do Pro; o Grátis usa o Descobrir.
  const paidPlan = hasPaidPlan(me?.creator);
  const activeContext = useMemo(() => {
    const base = ASSISTANT_CONTEXTS[assistantContext];
    const personalized = assistantContext === "discover" ? DISCOVER_BY_OBJECTIVE[me?.creator?.objetivo || ""] : null;
    return personalized ? { ...base, ...personalized } : base;
  }, [assistantContext, me?.creator?.objetivo]);

  // Sessão do chatbot: cada conversa ganha um ID e uma URL fixa
  // (/descobrir/{id}); reabri-la pelo histórico não chama a IA de novo.
  // Uma conversa já aberta nesta aba entra na tela antes do GET de confirmação.
  const cachedSession = useMemo(
    () => (sessionId ? peekDiscoverySession(me?.user_id, sessionId) : null),
    [sessionId, me?.user_id],
  );
  const [sessionLoading, setSessionLoading] = useState(Boolean(sessionId) && !cachedSession);
  const [deletingTurnId, setDeletingTurnId] = useState<number | null>(null);
  const [pendingDeleteTurn, setPendingDeleteTurn] = useState<PastTurn | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 1 | -1>>({});
  const [trending, setTrending] = useState<Product[]>([]);
  const sessionIdRef = useRef<string | null>(sessionId ?? null);
  const sessionTitleRef = useRef("");
  // Conversa em memória a ser persistida (turnos no formato SharedTurn).
  const sessionTurnsRef = useRef<SharedTurn[]>([]);

  /** Restaura a conversa salva: último turno volta em tela, os outros no passeio. */
  function restoreSession(loaded: DiscoverySession) {
    const turns = Array.isArray(loaded.turns)
      ? loaded.turns.filter((turn) => turn && (turn.query || turn.message || (Array.isArray(turn.products) && turn.products.length > 0)))
      : [];
    sessionTurnsRef.current = turns;
    sessionTitleRef.current = loaded.title || "";
    if (loaded.context === "create" || loaded.context === "surprise" || loaded.context === "week") {
      setAssistantContext(loaded.context);
    }
    if (!turns.length) {
      setSessionLoading(false);
      return;
    }
    const last = turns[turns.length - 1];
    const list = Array.isArray(last.products) ? (last.products as Product[]).filter((product) => product?.id) : [];
    setPastTurns(turns.slice(0, -1).map((turn, index) => ({
      id: ++turnSeq.current,
      index,
      query: turn.query,
      message: turn.message,
      products: (Array.isArray(turn.products) ? turn.products : []) as Product[],
      needsClarification: Boolean(turn.needs_clarification),
      imageName: turn.image_name ?? null,
    })));
    setTurnQuery(last.query || (last.image_name ? "" : "Sua busca"));
    setTurnImage(last.image_name ?? null);
    setResults(list);
    setMessage(last.message || (list.length ? "Não achei nenhum produto com esse filtro." : ""));
    setNeedsClarification(Boolean(last.needs_clarification));
    setContextIds(list.map((product) => product.id));
    setRevealedCount(list.length);
    setSearched(true);
    // A pergunta já está no balão do turno: o composer abre vazio para a próxima mensagem.
    setQuery("");
    setSessionLoading(false);
  }

  // Cache local: pinta a conversa antes do paint e deixa o GET confirmar depois.
  // Sem cache, o skeleton do chat abaixo cobre a espera.
  const restoredFromCache = useRef(false);
  useSafeLayoutEffect(() => {
    if (restoredFromCache.current || !cachedSession) return;
    restoredFromCache.current = true;
    restoreSession(cachedSession);
  }, [cachedSession]);

  // Abre a conversa do histórico: GET da sessão restaura tudo sem nova IA.
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void (async () => {
      try {
        const resolved = await resolveSession();
        const loaded = await fetchDiscoverySession(me?.user_id, sessionId, resolved?.access_token);
        if (!active) return;
        restoreSession(loaded);
      } catch (err) {
        if (!active) return;
        // Com uma versão em cache a conversa continua legível; sem cache, avisa.
        if (!cachedSession) {
          setSessionLoading(false);
          toast(friendlyError(err, "Não conseguimos abrir esta conversa. Tente novamente."));
        }
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }, [attachment]);

  useEffect(() => {
    let active = true;
    try {
      const pending = sessionStorage.getItem("temtrend_pending_search");
      if (pending) {
        hasPendingSearch.current = true;
        queueMicrotask(() => {
          if (!active) return;
          setQuery((current) => current || pending.slice(0, 500));
          sessionStorage.removeItem("temtrend_pending_search");
        });
      }
    } catch { /* armazenamento opcional */ }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { const saved = localStorage.getItem("temtrend-hide-sensitive") === "true"; queueMicrotask(() => setHideSensitive(saved)); } catch { /* optional preference */ }
  }, []);

  useEffect(() => {
    if (!openFilter) return;
    const close = (event: PointerEvent) => {
      if (!filterBarRef.current?.contains(event.target as Node)) setOpenFilter(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      filterBarRef.current?.querySelector<HTMLButtonElement>('.assistant-filter > button[aria-expanded="true"]')?.focus();
      setOpenFilter(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [openFilter]);

  // Ao enviar, a conversa desce: o turno novo aparece já no estado "gerando".
  useEffect(() => {
    if (!searching) return;
    const turn = turnRef.current;
    if (!turn) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      turn.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [searching]);

  useEffect(() => {
    if (searching || !searched) return;
    if (!scrollAfterSearch.current) return;
    const mode = scrollAfterSearch.current;
    scrollAfterSearch.current = false;
    const response = responseRef.current;
    if (!response) return;
    if (mode === "always") {
      response.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Busca nova: a página fica onde está. Só desce (sem animação) quando os
    // resultados começam fora da tela, como no celular.
    const top = response.getBoundingClientRect().top;
    if (top < window.innerHeight - 24) return;
    window.scrollBy({ top: top - 88, behavior: "auto" });
  }, [searching, searched, results]);

  useEffect(() => {
    // Sessão com link fixo: quem manda é o banco, não o rascunho de 2h da aba.
    // Descobrir clicado na sidebar (?nova=1) sempre abre a tela inicial:
    // sem restaurar o rascunho da conversa anterior.
    if (sessionId || novaChat || !me?.user_id) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (landingSearch || hasPendingSearch.current) return;
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as {
          savedAt?: number;
          query?: string;
          message?: string;
          results?: Product[];
          needsClarification?: boolean;
          contextIds?: string[];
          pastTurns?: PastTurn[];
          imageName?: string | null;
          turnQuery?: string;
        } | null;
        if (!saved?.savedAt || Date.now() - saved.savedAt > DISCOVERY_STATE_TTL) {
          sessionStorage.removeItem(storageKey);
        } else if (saved.query && saved.message && Array.isArray(saved.results)) {
          // O texto enviado pertence ao turno restaurado, não ao composer.
          setMessage(saved.message);
          setResults(saved.results);
          setNeedsClarification(Boolean(saved.needsClarification));
          setContextIds(Array.isArray(saved.contextIds) ? saved.contextIds : []);
          setPastTurns(Array.isArray(saved.pastTurns) ? saved.pastTurns.filter((turn) => turn && Array.isArray(turn.products)) : []);
          setTurnQuery(saved.turnQuery ?? saved.query);
          setTurnImage(saved.imageName ?? null);
          setRevealedCount(saved.results.length);
          setSearched(true);
        }
      } catch {
        /* Storage is optional. */
      }
    });

    return () => {
      active = false;
    };
  }, [storageKey, landingSearch, sessionId, novaChat, me?.user_id]);

  const refreshSearchHistory = useCallback(async () => {
    const requestId = ++historyRequestId.current;
    try {
      const session = await resolveSession();
      if (!session?.access_token) {
        if (requestId === historyRequestId.current) setSearchHistory([]);
        return;
      }
      const result = await api<{ items: DiscoverySearchSummary[] }>("/assistant/searches", session.access_token);
      if (requestId === historyRequestId.current) {
        setSearchHistory(Array.isArray(result.items) ? result.items : []);
      }
    } catch {
      // Histórico é um extra: se falhar, o Descobrir continua funcionando.
    }
  }, []);

  useEffect(() => {
    if (!me?.user_id) return;
    queueMicrotask(() => { void refreshSearchHistory(); });
  }, [me?.user_id, refreshSearchHistory]);

  const topResults = useMemo(() => results.filter((product) => !hideSensitive || !isSensitive(product)).sort((a, b) => {
    if (sortBy === "preco") return (a.preco_min_brl ?? Infinity) - (b.preco_min_brl ?? Infinity);
    if (sortBy === "comissao") return (commissionOf(b) ?? -1) - (commissionOf(a) ?? -1);
    return salesOf(b) - salesOf(a);
  }), [results, hideSensitive, sortBy]);
  const highlight = useMemo(() => highlightFor(topResults), [topResults]);
  const comparedProducts = topResults.filter((product) => compareIds.includes(product.id));
  // Revelação progressiva: os produtos entram um por vez, como uma resposta viva.
  useEffect(() => {
    if (searching) return;
    if (revealedCount >= topResults.length) return;
    const timer = setTimeout(() => {
      setRevealedCount((current) => Math.min(current + 1, topResults.length));
    }, 260);
    return () => clearTimeout(timer);
  }, [searching, revealedCount, topResults.length]);
  const visibleResults = topResults.slice(0, Math.min(revealedCount, topResults.length));

  // Salvar/remover muda o botão na hora; o servidor só corrige se falhar.
  const [optimisticSaved, setOptimisticSaved] = useState<Record<string, boolean>>({});
  // Id do conteúdo criado agora, para remover sem esperar a lista recarregar.
  const createdContentIds = useRef<Record<string, string>>({});
  const savedFor = (id: string) =>
    optimisticSaved[id] ?? Boolean(productionForProduct(productions, id));

  function setOptimistic(id: string, value: boolean) {
    setOptimisticSaved((current) => ({ ...current, [id]: value }));
  }

  async function saveProduct(id: string) {
    if (savingProductId || savedFor(id)) return;
    setOptimistic(id, true);
    setSavingProductId(id);
    try {
      const resolved = await resolveSession();
      const created = await api<CreatorContent>("/creator-content", resolved?.access_token, {
        method: "POST",
        body: JSON.stringify({ product_id: id }),
      });
      if (created?.id) createdContentIds.current[id] = created.id;
      toast("Produto salvo. Ele já está em Produtos selecionados.");
      void loadProductions();
    } catch (err) {
      setOptimistic(id, false);
      toast(friendlyError(err, "Não conseguimos salvar este produto. Tente novamente."));
    } finally {
      setSavingProductId(null);
    }
  }

  async function removeSaved(id: string) {
    if (savingProductId) return;
    const contentId = createdContentIds.current[id] ?? productions.find((item) => item.product_id === id)?.id;
    setOptimistic(id, false);
    setSavingProductId(id);
    try {
      if (contentId) {
        const resolved = await resolveSession();
        await api(`/creator-content/${contentId}`, resolved?.access_token, { method: "DELETE" });
      }
      delete createdContentIds.current[id];
      track("saved_product_removed", { product_id: id });
      toast("Produto removido dos salvos.");
      void loadProductions();
    } catch (err) {
      setOptimistic(id, true);
      toast(friendlyError(err, "Não conseguimos remover este produto. Tente novamente."));
    } finally {
      setSavingProductId(null);
    }
  }

  /**
   * Clique no produto do chat: abre direto a tela de gravar conteúdo. O roteiro
   * é reutilizado quando já existe; senão a IA gera um antes de navegar.
   */
  async function startRecording(productId: string) {
    if (recordingProductId) return;
    const product = results.find((item) => item.id === productId)
      ?? pastTurns.flatMap((turn) => turn.products).find((item) => item.id === productId);
    setRecordingProductId(productId);
    try {
      const resolved = await resolveSession();
      const kit = (await api<{ content_kit: ContentKit }>(`/products/${productId}/content-kit`, resolved?.access_token, {
        method: "POST",
        body: JSON.stringify({ force_new: false }),
        timeoutMs: 90_000,
      })).content_kit;
      // Cache quente: a tela de gravação já abre com o roteiro preenchido.
      if (product) primeProductDetail(product, kit);
      notifyPlanUsageChanged();
      setRecordingProductId(null);
      router.push(`/produtos/${productId}/kits/${kit.id}`);
    } catch (err) {
      const code = (err as ApiError).code;
      if (code === "PLAN_LIMIT") {
        setPlanLimitMessage((err as Error).message || "Você atingiu o limite do seu plano.");
        track("upgrade_cta_view", { source: "assistant_record" });
      } else {
        toast(friendlyError(err, "Não conseguimos abrir a tela de gravação. Tente novamente."));
      }
      setRecordingProductId(null);
    }
  }

  /**
   * Persiste a conversa no histórico (POST cria, PATCH atualiza). No primeiro
   * turno, a URL vira /descobrir/{id} — sem remontar a página, como um
   * rascunho que ganha endereço. Falha de persistência não derruba a busca:
   * o turno seguinte reenvia tudo o que está em memória.
   */
  async function saveSessionTurn(turn: SharedTurn) {
    if (turn.query || turn.message || turn.products.length) {
      sessionTurnsRef.current = [...sessionTurnsRef.current, turn];
    }
    try {
      const resolved = await resolveSession();
      if (!resolved?.access_token || !sessionTurnsRef.current.length) return;
      if (!sessionIdRef.current) {
        const created = await api<{ session: DiscoverySessionSummary }>("/assistant/sessions", resolved.access_token, {
          method: "POST",
          body: JSON.stringify({
            title: sessionTitleRef.current || conversationTitle(turn.query),
            context: assistantContext,
            turns: sessionTurnsRef.current,
          }),
        });
        if (created.session?.id) {
          sessionIdRef.current = created.session.id;
          sessionTitleRef.current = created.session.title;
          rememberDiscoverySession(me?.user_id, { ...created.session, turns: sessionTurnsRef.current });
          // Sem navegação do router: só a barra de endereço muda.
          window.history.replaceState(null, "", `/descobrir/${created.session.id}`);
          notifySessionsChanged();
        }
      } else {
        const updated = await api<{ session: DiscoverySessionSummary }>(`/assistant/sessions/${sessionIdRef.current}`, resolved.access_token, {
          method: "PATCH",
          body: JSON.stringify({ turns: sessionTurnsRef.current }),
        });
        if (updated.session?.title) sessionTitleRef.current = updated.session.title;
        if (updated.session) {
          rememberDiscoverySession(me?.user_id, { ...updated.session, turns: sessionTurnsRef.current });
        }
        notifySessionsChanged();
      }
    } catch {
      // Histórico é um extra: a conversa continua no chat mesmo sem salvar.
    }
  }

  /**
   * Apaga um turno (pergunta + resposta) da conversa. A lista salva só é
   * alterada quando o turno em memória corresponde ao exibido, para não
   * remover a mensagem errada; falha de rede desfaz a remoção.
   */
  useEffect(() => {
    const token = session?.access_token;
    if (!paidPlan || !token) return;
    let active = true;
    void (async () => {
      try {
        const normalize = (value: unknown): Product[] => {
          if (Array.isArray(value)) return value as Product[];
          const items = (value as { items?: Product[] } | null)?.items;
          return Array.isArray(items) ? items : [];
        };
        const list = normalize(await api<unknown>("/products?limit=50", token));
        const withCommission = list
          .filter((item) => item.comissao_percentual != null)
          .sort((a, b) => (b.comissao_percentual ?? 0) - (a.comissao_percentual ?? 0));
        const chosen = (withCommission.length ? withCommission : list).slice(0, 6);
        if (active) setTrending(chosen);
      } catch (error) {
        // A vitrine é um extra: se falhar, a tela segue sem ela.
        console.warn("[trending] não foi possível carregar os produtos em alta", error);
      }
    })();
    return () => { active = false; };
  }, [session?.access_token, paidPlan]);

  // Paywall da vitrine: mede uma vez por visita quantas contas grátis a veem.
  const trendingPaywallTracked = useRef(false);
  useEffect(() => {
    if (paidPlan || searched || trendingPaywallTracked.current) return;
    trendingPaywallTracked.current = true;
    track("paywall_view", { source: "discover_trending" });
  }, [paidPlan, searched]);

  async function confirmDeleteTurn() {    const target = pendingDeleteTurn;
    if (!target || deletingTurnId !== null) return;
    const previousPast = pastTurns;
    const previousTurns = sessionTurnsRef.current;
    const position = typeof target.index === "number" ? target.index : -1;
    const aligned = position >= 0
      && previousTurns[position]?.query === target.query
      && previousTurns[position]?.message === target.message;
    setPastTurns(previousPast
      .filter((turn) => turn.id !== target.id)
      .map((turn) => (aligned && typeof turn.index === "number" && turn.index > position
        ? { ...turn, index: turn.index - 1 }
        : turn)));
    if (aligned) sessionTurnsRef.current = previousTurns.filter((_, index) => index !== position);
    setDeletingTurnId(target.id);
    setPendingDeleteTurn(null);
    try {
      const resolved = await resolveSession();
      if (!aligned || !sessionIdRef.current || !resolved?.access_token) return;
      await api(`/assistant/sessions/${sessionIdRef.current}`, resolved.access_token, {
        method: "PATCH",
        body: JSON.stringify({ turns: sessionTurnsRef.current }),
      });
      const cached = peekDiscoverySession(me?.user_id, sessionIdRef.current);
      if (cached) {
        rememberDiscoverySession(me?.user_id, {
          ...cached,
          turn_count: sessionTurnsRef.current.length,
          updated_at: new Date().toISOString(),
          turns: sessionTurnsRef.current,
        });
      }
      notifySessionsChanged();
      toast("Mensagem apagada.");
    } catch {
      setPastTurns(previousPast);
      sessionTurnsRef.current = previousTurns;
      toast("Não conseguimos apagar a mensagem agora. Tente novamente.");
    } finally {
      setDeletingTurnId(null);
    }
  }

  async function search(text: string, fresh = false, displayQuery?: string, retryAttachment?: ImageAttachment | null) {
    if (inFlight.current) return;
    const trimmed = text.trim();
    const shownQuery = (displayQuery ?? trimmed) || "Me surpreenda";
    // Cada envio fecha o turno anterior e abre um novo turno na conversa.
    const nextPastTurns = searched && message && !error
      ? [...pastTurns, {
        id: ++turnSeq.current,
        index: sessionTurnsRef.current.length - 1,
        query: turnQuery || shownQuery,
        message,
        products: results,
        needsClarification,
        imageName: turnImage,
      }].slice(-MAX_PAST_TURNS)
      : pastTurns;
    const outgoingAttachment = retryAttachment ?? attachment;
    const sentImage = outgoingAttachment?.name ?? null;
    // A transição de tela só faz sentido quando o palco inicial dá lugar à conversa.
    const enteringConversation = !searched;
    const applyState = (update: () => void) => (enteringConversation ? withDiscoveryTransition(update) : Promise.resolve(update()));
    if (trimmed.length < 3 && !outgoingAttachment) {
      await applyState(() => {
        if (nextPastTurns !== pastTurns) setPastTurns(nextPastTurns);
        setTurnQuery(shownQuery);
        setTurnImage(sentImage);
        setRevealedCount(0);
        setSearched(true);
        setQuery("");
        setMessage("Conte um pouco mais sobre o produto que você procura (mínimo de 3 caracteres).");
        setResults([]);
        setNeedsClarification(true);
        setError(false);
      });
      return;
    }
    inFlight.current = true;
    lastSentQuery.current = trimmed;
    lastSentAttachment.current = outgoingAttachment;
    // Primeiro envio: o composer e o palco inicial dão lugar à conversa.
    await applyState(() => {
      setPastTurns(nextPastTurns);
      setTurnQuery(shownQuery);
      setTurnImage(sentImage);
      setRevealedCount(0);
      setOpenFilter(null);
      setSearching(true);
      // O rascunho sai do composer ao enviar: texto e imagem viram a mensagem do chat.
      setQuery("");
      setAttachment(null);
      setSearched(true);
      setError(false);
      setWeeklyItems([]);
      setWeeklyProgress("");
      setWeeklyLimit(false);
      setNeedsClarification(false);
      setImageContext("");
      setMessage("Olhando o catálogo…");
    });
    // A conversa desce e o turno novo entra em foco enquanto a resposta é gerada.
    scrollAfterSearch.current = "always";
    const slow = setTimeout(() => {
      setMessage("Ainda estou conferindo o catálogo — mais alguns segundos.");
    }, 9000);
    try {
      const resolved = await resolveSession();
      const baseMessage = trimmed || "Encontre produtos parecidos com esta referência visual.";
      const contextualMessage = assistantContext === "week"
        ? `Planeje sete dias de conteúdo completos para esta semana. ${baseMessage}`
        : assistantContext === "create"
          ? `Quero criar conteúdo sobre esta ideia e preciso escolher um produto do catálogo. ${baseMessage}`
          : baseMessage;
      const payload: { message: string; product_ids?: string[]; image?: { mime_type: ImageAttachment["mimeType"]; data: string } } = { message: contextualMessage };
      if (!fresh && contextIds.length) payload.product_ids = contextIds;
      if (outgoingAttachment) payload.image = { mime_type: outgoingAttachment.mimeType, data: outgoingAttachment.data };
      const result = await api<AssistantResponse>("/assistant/products", resolved?.access_token, {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: outgoingAttachment ? 70_000 : 20_000,
      });
      clearTimeout(slow);
      const list = Array.isArray(result.products) ? result.products : [];
      setContextIds(list.map((p) => p.id));
      setMessage(result.message || "Não achei nenhum produto com esse filtro.");
      setResults(list);
      // Os produtos entram um por vez, como uma resposta sendo escrita.
      setRevealedCount(list.length ? 1 : 0);
      setNeedsClarification(Boolean(result.needs_clarification));
      setImageContext(result.image_context || "");
      track("search_performed", { q_len: trimmed.length, results: list.length, clarification: Boolean(result.needs_clarification) });
      saveDiscoveryState(storageKey, {
        query: trimmed,
        message: result.message || "Não achei nenhum produto com esse filtro.",
        results: list,
        needsClarification: Boolean(result.needs_clarification),
        contextIds: list.map((product) => product.id),
        pastTurns: nextPastTurns,
        imageName: sentImage,
        turnQuery: shownQuery,
      });
      void saveSessionTurn({
        query: shownQuery,
        message: result.message || "Não achei nenhum produto com esse filtro.",
        products: list,
        needs_clarification: Boolean(result.needs_clarification),
        image_name: sentImage,
      });
      void refreshSearchHistory();
      notifyPlanUsageChanged();
      if (result.weekly_plan_requested && list.length) {
        setWeeklyProgress(`Preparando 1 de ${list.length} dias…`);
        await prepareWeeklyResponse(list, resolved?.access_token);
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(true);
      setResults([]);
      setRevealedCount(0);
      setNeedsClarification(false);
      if (code === "PLAN_LIMIT") {
        // O diálogo já explica o limite. Não mostre também o erro genérico de busca.
        const text = (err as Error).message || "Você atingiu o limite do seu plano.";
        scrollAfterSearch.current = false;
        setSearched(false);
        setError(false);
        setMessage("");
        setPlanLimitMessage(text);
        track("upgrade_cta_view", { source: "assistant_limit" });
      } else {
        setMessage(code === "IMAGE_ANALYSIS_UNAVAILABLE"
          ? "Não foi possível analisar a imagem. Tente novamente ou descreva o produto em texto."
          : (err as { message?: string })?.message || "Não conseguimos concluir sua busca agora.");
      }
    } finally {
      clearTimeout(slow);
      inFlight.current = false;
      setSearching(false);
    }
  }

  async function prepareWeeklyResponse(products: Product[], token?: string) {
    if (!token) { setWeeklyProgress("Entre na sua conta para preparar os roteiros."); return; }
    const distinct = Array.from(new Map(products.map((product) => [product.id, product])).values()).slice(0, 7);
    const existing = new Map(productions.map((item) => [item.product_id, item]));
    let created = 0;
    let quotaBlocked = false;
    let available: number | null = null;
    try {
      const billing = await api<BillingSubscriptionSummary>("/billing/subscription", token);
      const free = (billing.plan ?? me?.creator?.plan ?? "free") === "free";
      const limit = billing.limits?.productionItems ?? (free ? 1 : null);
      available = limit == null ? null : Math.max(0, limit - productions.length);
    } catch {
      const free = (me?.creator?.plan ?? "free") === "free";
      available = free ? Math.max(0, 3 - productions.length) : null;
    }
    const completed: WeeklyItem[] = [];
    for (const [index, product] of distinct.entries()) {
      setWeeklyProgress(`Preparando ${index + 1} de ${distinct.length} dias…`);
      const date = weekDate(index);
      const prior = existing.get(product.id);
      if (quotaBlocked) {
        completed.push({ product, date, error: "Assim que abrir espaço no seu plano, eu gero este roteiro." });
        setWeeklyItems([...completed]);
        continue;
      }
      if (!prior && available !== null && created >= available) {
        completed.push({ product, date, error: "Seu plano já está no limite de conteúdos." });
        setWeeklyLimit(true);
        setWeeklyItems([...completed]);
        continue;
      }
      if (prior?.status === "publicado") {
        completed.push({ product, date, error: "Este produto já foi publicado. Escolha outro no planejamento." });
        setWeeklyItems([...completed]);
        continue;
      }
      try {
        const kit = prior?.content_kits ?? (await api<{ content_kit: ContentKit }>(`/products/${product.id}/content-kit`, token, {
          method: "POST", body: JSON.stringify({ force_new: false }), timeoutMs: 90_000,
        })).content_kit;
        const content = prior?.content_kit_id
          ? prior
          : await api<CreatorContent>("/creator-content", token, { method: "POST", body: JSON.stringify({ product_id: product.id }) });
        if (!prior) created++;
        if (content.scheduled_for !== date) {
          await api(`/creator-content/${content.id}`, token, { method: "PATCH", body: JSON.stringify({ scheduled_for: date }) });
        }
        existing.set(product.id, { ...content, scheduled_for: date, content_kits: kit });
        completed.push({ product, date, kit });
      } catch (error) {
        if ((error as ApiError).code === "PLAN_LIMIT") {
          quotaBlocked = true;
          setWeeklyLimit(true);
        }
        completed.push({ product, date, error: friendlyError(error, "Não foi possível preparar este dia.") });
      }
      setWeeklyItems([...completed]);
    }
    setWeeklyProgress(`${completed.filter((item) => item.kit).length} de ${distinct.length} dias preparados. ${distinct.length < 7 ? "O catálogo tem menos de 7 produtos disponíveis para esta busca." : ""}`);
    await loadProductions();
    notifyPlanUsageChanged();
  }

  /** Nova busca no próprio chat: a conversa atual fica no histórico; a tela só se limpa. */
  function reset(nextContext: AssistantContext = "discover") {
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
    if (sessionIdRef.current) {
      sessionIdRef.current = null;
      sessionTurnsRef.current = [];
      sessionTitleRef.current = "";
      window.history.replaceState(null, "", "/descobrir");
    }
    // Volta do chat para o palco inicial com a mesma continuidade da entrada.
    const applyReset = () => {
      setContextIds([]);
      setSearched(false);
      setResults([]);
      setPastTurns([]);
      setRevealedCount(0);
      setTurnQuery("");
      setTurnImage(null);
      setWeeklyItems([]);
      setWeeklyProgress("");
      setNeedsClarification(false);
      setMessage("");
      setError(false);
      setCompareIds([]);
      setImageContext("");
      setQuery("");
      setAssistantContext(nextContext);
    };
    if (searched) void withDiscoveryTransition(applyReset);
    else applyReset();
  }

  function changeContext(next: AssistantContext) {
    setOpenFilter(null);
    // Dentro de uma conversa, o modo muda no próprio chat (a próxima mensagem já usa o novo modo).
    if (searched) {
      setAssistantContext(next);
      return;
    }
    reset(next);
  }

  async function attachImage(file?: File) {
    if (!file) return;
    setPreparingImage(true);
    try {
      const next = await prepareImageAttachment(file);
      setAttachment(next);
      toast("Imagem adicionada como referência visual.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível adicionar esta imagem.");
    } finally {
      setPreparingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function removeAttachment() {
    setAttachment(null);
    setImageContext("");
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current.slice(-1), id]);
  }

  async function openSavedSearch(id: string) {
    if (historyBusyId || historyClearing) return;
    setHistoryBusyId(id);
    setHistoryError("");
    try {
      const session = await resolveSession();
      const saved = await api<DiscoverySearch>(`/assistant/searches/${id}`, session?.access_token);
      const list = Array.isArray(saved.results) ? saved.results : [];
      const savedMessage = saved.message || "Não achei nenhum produto com esse filtro.";
      const ids = Array.isArray(saved.context_ids) ? saved.context_ids : list.map((product) => product.id);
      setQuery("");
      setMessage(savedMessage);
      setResults(list);
      setNeedsClarification(Boolean(saved.needs_clarification));
      setContextIds(ids);
      setPastTurns([]);
      setRevealedCount(list.length);
      setTurnQuery(saved.query || "");
      setTurnImage(null);
      setSearched(true);
      setError(false);
      setCompareIds([]);
      saveDiscoveryState(storageKey, {
        query: saved.query || "",
        message: savedMessage,
        results: list,
        needsClarification: Boolean(saved.needs_clarification),
        contextIds: ids,
        pastTurns: [],
        imageName: null,
        turnQuery: saved.query || "",
      });
      // Reabrir uma busca antiga ganha conversa própria no histórico: o
      // primeiro turno já é persistido, então o link volta a existir.
      const turn: SharedTurn = {
        query: saved.query || "Sua busca",
        message: savedMessage,
        products: list,
        needs_clarification: Boolean(saved.needs_clarification),
        image_name: null,
      };
      sessionTurnsRef.current = [turn];
      sessionTitleRef.current = conversationTitle(turn.query);
      sessionIdRef.current = null;
      try {
        const created = await api<{ session: DiscoverySessionSummary }>("/assistant/sessions", session?.access_token, {
          method: "POST",
          body: JSON.stringify({ title: conversationTitle(turn.query), context: assistantContext, turns: sessionTurnsRef.current }),
        });
        if (created.session?.id) {
          sessionIdRef.current = created.session.id;
          sessionTitleRef.current = created.session.title;
          rememberDiscoverySession(me?.user_id, { ...created.session, turns: sessionTurnsRef.current });
          window.history.replaceState(null, "", `/descobrir/${created.session.id}`);
        }
      } catch { /* histórico é um extra: a busca continua aberta no chat */ }
      scrollAfterSearch.current = "always";
      setHistoryOpen(false);
    } catch (err) {
      const failure = friendlyError(err, "Não conseguimos abrir esta busca. Tente novamente.");
      setHistoryError(failure);
      if (!historyOpen) toast(failure);
      void refreshSearchHistory();
    } finally {
      setHistoryBusyId(null);
    }
  }

  async function deleteSavedSearch(id: string) {
    if (historyBusyId || historyClearing) return;
    setHistoryBusyId(id);
    setHistoryError("");
    try {
      const session = await resolveSession();
      await api(`/assistant/searches/${id}`, session?.access_token, { method: "DELETE" });
      historyRequestId.current += 1;
      setSearchHistory((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setHistoryError(friendlyError(err, "Não conseguimos remover esta busca. Tente novamente."));
    } finally {
      setHistoryBusyId(null);
    }
  }

  async function clearSavedSearches() {
    if (historyClearing) return;
    setHistoryClearing(true);
    setHistoryError("");
    try {
      const session = await resolveSession();
      await api("/assistant/searches", session?.access_token, { method: "DELETE" });
      historyRequestId.current += 1;
      setSearchHistory([]);
      toast("Histórico de buscas limpo.");
    } catch (err) {
      setHistoryError(friendlyError(err, "Não conseguimos limpar o histórico. Tente novamente."));
    } finally {
      setHistoryClearing(false);
    }
  }

  // Mesmo composer em dois lugares: no hero (antes da primeira busca) e no
  // dock fixo do rodapé (depois que a conversa começa).
  const tabsRow = (
    <div className="assistant-tabs" role="tablist" aria-label="Modo de busca">
      {ASSISTANT_TABS.map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={value === assistantContext}
          className={value === assistantContext ? "is-active" : undefined}
          disabled={searching}
          onClick={() => { if (value !== assistantContext) changeContext(value); }}
        >
          <Icon name={CONTEXT_ICON[value]} size={15} filled={value === assistantContext && value === "surprise"} />
          <span>{ASSISTANT_CONTEXTS[value].label}</span>
        </button>
      ))}
    </div>
  );

  const filtersRow = (
    <div className="assistant-filters" ref={filterBarRef}>
      {FILTER_GROUPS.map((group) => {
        const selected = group.options.find(([, text]) => text === query);
        const isOpen = openFilter === group.label;
        return (
          <div className="assistant-filter" key={group.label}>
            <button
              type="button"
              className={isOpen ? "is-open" : undefined}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-label={`Abrir opções de ${group.label.toLowerCase()}`}
              disabled={searching}
              onClick={() => setOpenFilter((current) => current === group.label ? null : group.label)}
            >
              <Icon name={group.icon} size={14} />
              <span>{selected?.[0] ?? group.label}</span>
              <Icon name="chevron-down" size={13} className="assistant-filter-chevron" />
            </button>
            {isOpen && (
              <div className="assistant-filter-popup" role="menu" aria-label={`Opções de ${group.label.toLowerCase()}`}>
                {group.options.map(([label, text]) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitemradio"
                    aria-checked={query === text}
                    onClick={() => {
                      setOpenFilter(null);
                      setQuery(text);
                      setContextIds([]);
                      void search(text, true);
                    }}
                  >
                    <span>{label}</span>
                    {query === text && <Icon name="check" size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const visiblePastTurns = useMemo(() => {
    const currentQuery = turnQuery || "";
    // Nunca renderiza duas vezes o mesmo turno: o último turno fechado não
    // pode repetir a mensagem que já está no turno atual.
    const withoutCurrentEcho = pastTurns.filter(
      (turn) => !(turn.message === message && turn.query === currentQuery),
    );
    return withoutCurrentEcho.filter((turn, index) => {
      const previous = withoutCurrentEcho[index - 1];
      return !previous || previous.message !== turn.message || previous.query !== turn.query;
    });
  }, [pastTurns, message, turnQuery]);

  const composerForm = (
    <form
      id="discovery-search-form"
      className="assistant-form is-chat"
      onSubmit={(e) => {
        e.preventDefault();
        if (!query.trim() && !attachment && assistantContext !== "surprise") {
          e.currentTarget.querySelector<HTMLTextAreaElement>("#assistant-input")?.focus();
          return;
        }
        if (assistantContext === "surprise" && !query.trim() && !attachment) {
          void search(SURPRISE_PROMPT, true, "");
          return;
        }
        search(query);
      }}
    >
      <label htmlFor="assistant-input">
        {activeContext.fieldLabel}
      </label>
      <div className="assistant-composer">
        <textarea
          id="assistant-input"
          name="discovery-query"
          ref={chatInputRef}
          maxLength={500}
          autoComplete="off"
          rows={1}
          required={assistantContext !== "surprise" && !attachment}
          placeholder={COMPOSER_PLACEHOLDER}
          value={query}
          onChange={(e) => { setQuery(e.target.value); autoGrow(e.currentTarget); }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            if (searching || preparingImage) return;
            if (!query.trim() && !attachment) return;
            event.currentTarget.form?.requestSubmit();
          }}
        />
        {attachment && <div className="assistant-attachment" aria-label={`Imagem anexada: ${attachment.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.previewUrl} alt="Prévia da referência visual" />
          <span><strong>Referência visual</strong><small>{attachment.name}</small></span>
          <button type="button" onClick={removeAttachment} aria-label="Remover imagem"><Icon name="x" size={16} /></button>
        </div>}
        <div className="assistant-composer-tools">
          <input ref={imageInputRef} className="assistant-image-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void attachImage(event.target.files?.[0])} />
          <button
            type="button"
            className="assistant-attach-button"
            disabled={searching || preparingImage}
            onClick={() => imageInputRef.current?.click()}
            title="Anexar imagem de referência"
            aria-label={attachment ? "Trocar imagem de referência" : "Anexar imagem de referência"}
          >
            <Icon name="image" size={17} /> <span>{preparingImage ? "Preparando imagem…" : attachment ? "Trocar imagem" : "Enviar imagem"}</span>
          </button>
          <div className="assistant-composer-end">
            {query.length >= 400 && <span className="assistant-char-count">{query.length}/500</span>}
            <button className="assistant-send-button" type="submit" disabled={searching || preparingImage || (!query.trim() && !attachment && assistantContext !== "surprise")}>
              <span>{searching ? (weeklyProgress ? "Preparando semana…" : "Analisando…") : activeContext.submit}</span>
              <Icon name={searching ? "refresh" : "arrow-up-right"} size={16} className={searching ? "is-spinning" : undefined} />
            </button>
          </div>
        </div>
      </div>
      <div className="assistant-dock-chips">{tabsRow}{filtersRow}</div>
    </form>
  );

  // Sessão vinda do histórico: já abre no palco da conversa (sem a arte do
  // Descobrir). Com cache local o chat aparece na hora; sem cache, um esqueleto
  // de mensagens cobre o GET.
  if (sessionLoading) {
    return (
      <section
        id="assistant-section"
        className="dashboard-hero assistant-hero discovery-workspace context-discover is-docked"
        aria-busy="true"
        aria-label="Abrindo conversa do Descobrir"
      >
        <div className="assistant-response discovery-chat is-loading">
          <div className="chat-thread chat-skeleton" aria-hidden="true">
            <span className="chat-skeleton-line is-user" />
            <span className="chat-skeleton-line" />
            <span className="chat-skeleton-line is-short" />
          </div>
          <p className="sr-only" role="status">Abrindo sua conversa…</p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="assistant-section"
      className={`dashboard-hero assistant-hero discovery-workspace context-${assistantContext}${searched ? " is-docked" : ""}`}
      aria-labelledby={searched ? undefined : "dashboard-title"}
      aria-label={searched ? "Conversa do Descobrir" : undefined}
    >
      {!searched && (
        <div className="discovery-hero">
          <div className="discover-intro">
            <h1 id="dashboard-title"><HighlightedTitle text={activeContext.title} /></h1>
            <p>{activeContext.description}</p>
          </div>
          {themeShortcuts.length > 0 && (
            <div className="discovery-profile" aria-label="Preferências do seu perfil">
              {themeShortcuts.length > 0 && <span className="discovery-profile-label">Seus temas</span>}
              {themeShortcuts.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  disabled={searching}
                  onClick={() => {
                    const text = `Quero produtos de ${theme}`;
                    setQuery(text);
                    void search(text, true);
                  }}
                >
                  {theme}<Icon name="arrow-up-right" size={12} />
                </button>
              ))}
            </div>
          )}
          {composerForm}
          <p className="discovery-note">
            <span className="discovery-check"><Icon name="check" size={15} /></span>
            {assistantContext === "week" ? "Produtos, roteiros, legendas e hashtags organizados para os próximos sete dias." : assistantContext === "surprise" ? "Uma seleção do catálogo com preço, vendas e comissão para você decidir." : "Produtos reais do catálogo. A imagem é analisada apenas para entender sua referência."}
          </p>
        </div>
      )}
      {!searched && (paidPlan ? trending.length > 0 && (
        <section className="tt-trending" aria-labelledby="trending-title">
          <header className="tt-trending-head">
            <div>
              <p className="eyebrow">Em alta</p>
              <h2 id="trending-title">Produtos em alta</h2>
              <p>Com as melhores comissões do catálogo agora.</p>
            </div>
          </header>
          <div className="tt-trending-grid">
            {trending.map((item) => (
              <Link key={item.id} href={`/produtos/${item.id}`} className="tt-trend-card">
                <span className="tt-trend-media">
                  <ProductImage product={item} width={64} height={64} />
                </span>
                <span className="tt-trend-body">
                  <small>{item.categoria || "Produto"}</small>
                  <strong>{displayProductName(item)}</strong>
                  <span className="tt-trend-meta">
                    <em>{item.preco_texto || (item.preco_min_brl != null ? BRL.format(item.preco_min_brl) : "Preço não informado")}</em>
                    {item.comissao_percentual != null && (
                      <span className="tt-trend-commission">{item.comissao_percentual}% comissão</span>
                    )}
                  </span>
                </span>
                <Icon name="arrow-right" size={16} />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="tt-trending" aria-labelledby="trending-title">
          <header className="tt-trending-head">
            <div>
              <p className="eyebrow">Em alta · Pro</p>
              <h2 id="trending-title">Produtos em alta</h2>
              <p>O ranking do catálogo é exclusivo para assinantes.</p>
            </div>
          </header>
          <div className="tt-trending-locked">
            <span className="tt-trending-locked-icon" aria-hidden="true"><Icon name="lock" size={20} /></span>
            <div className="tt-trending-locked-copy">
              <strong>Os produtos em alta estão no plano Pro.</strong>
              <p>No Grátis você usa o Descobrir para criar seus primeiros conteúdos. Com o Pro, acompanhe os produtos com mais vendas e comissão do catálogo.</p>
            </div>
            <Link
              className="tt-trending-cta"
              href="/conta/planos"
              onClick={() => track("upgrade_click", { source: "discover_trending" })}
            >
              Conhecer o Pro <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </section>
      ))}
      {searched && (
        <div className={`assistant-response discovery-chat${searching ? " is-generating" : ""}`} ref={responseRef} aria-busy={searching}>
          <div className="chat-thread" role="log" aria-live="polite" aria-relevant="additions">
            {visiblePastTurns.map((turn) => (
              <article key={turn.id} className="chat-turn is-past">
                <div className="chat-row is-user">
                  <div className="chat-user">
                    <span className="chat-author">Você</span>
                    <p className="chat-bubble">{turn.query}</p>
                    {turn.imageName && <span className="chat-attachment-chip"><Icon name="image" size={14} /> {turn.imageName}</span>}
                  </div>
                  <span className="chat-avatar is-user" aria-hidden="true"><Icon name="user" size={17} /></span>
                </div>
                <div className="chat-row is-assistant">
                  <span className="chat-avatar is-assistant" aria-hidden="true"><Icon name="arrow-up-right" size={15} /></span>
                  <div className="chat-content">
                    <div className="chat-head">
                      <span className="chat-author">TemTrend <small>assistente</small></span>
                    </div>
                    <div className="chat-card">
                      <p className="chat-message">{turn.message}</p>
                    </div>
                    {turn.products.length > 0 && (
                      <div className="chat-past-products" aria-label="Produtos sugeridos nesta busca">
                        {turn.products.map((product) => (
                          <button key={product.id} type="button" className="chat-product" onClick={() => setDetailsId(product.id)} aria-label={`Ver produto ${displayProductName(product)}`}>
                            <span className="chat-product-image"><ProductImage product={product} width={48} height={48} /></span>
                            <span className="chat-product-copy">
                              <strong>{displayProductName(product)}</strong>
                              <small>{product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "Preço não informado")}</small>
                            </span>
                            <Icon name="arrow-right" size={15} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
            <article className="chat-turn is-current" ref={turnRef}>
              <div className="chat-row is-user">
                <div className="chat-user">
                  <span className="chat-author">Você</span>
                  <p className="chat-bubble">{turnQuery || "Sua busca"}</p>
                  {turnImage && <span className="chat-attachment-chip"><Icon name="image" size={14} /> {turnImage}</span>}
                </div>
                <span className="chat-avatar is-user" aria-hidden="true"><Icon name="user" size={17} /></span>
              </div>
              <div className="chat-row is-assistant">
                <span className="chat-avatar is-assistant" aria-hidden="true"><Icon name="arrow-up-right" size={15} /></span>
                <div className="chat-content">
                  <span className="chat-author">TemTrend <small>{searching ? "gerando resposta" : "assistente"}</small></span>
                  {searching
                    ? <ChatThinking label={message} />
                    : message
                      ? (
                        <div className="chat-card">
                          <AnimatedMessage text={message} />
                          {pastTurns.length === 0 && (
                            <div className="chat-suggestions" aria-label="Como você prefere começar?">
                              <button type="button" onClick={() => { const text = "Quero produtos por preço: até R$ 50"; setQuery(text); void search(text, true); }}>
                                <Icon name="percent" size={14} /> Por preço
                              </button>
                              <button type="button" onClick={() => { const text = "Quero produtos por nicho: casa e cozinha"; setQuery(text); void search(text, true); }}>
                                <Icon name="grid" size={14} /> Por nicho
                              </button>
                              <button type="button" onClick={() => { const text = "Quero produtos fáceis de gravar"; setQuery(text); void search(text, true); }}>
                                <Icon name="video" size={14} /> Fácil de gravar
                              </button>
                              <button type="button" onClick={() => { changeContext("surprise"); setQuery(""); void search(SURPRISE_PROMPT, true, ""); }}>
                                <Icon name="sparkles" size={14} /> Me surpreenda
                              </button>
                            </div>
                          )}
                        </div>
                      )
                      : null}
                  {!searching && message && (
                    <div className="chat-actions">
                      <button type="button" aria-label="Copiar resposta" title="Copiar resposta" onClick={() => { void copyText(message).then((ok) => toast(ok ? "Resposta copiada." : "Não foi possível copiar a resposta.")); }}>
                        <Icon name="copy" size={14} />
                      </button>
                      <button type="button" aria-label="Resposta útil" title="Resposta útil" aria-pressed={feedback.current === 1} className={feedback.current === 1 ? "is-on" : undefined} onClick={() => { setFeedback((current) => ({ ...current, current: 1 })); toast("Obrigado pelo feedback."); }}>
                        <Icon name="check" size={14} />
                      </button>
                      <button type="button" aria-label="Resposta não útil" title="Resposta não útil" aria-pressed={feedback.current === -1} className={feedback.current === -1 ? "is-on" : undefined} onClick={() => { setFeedback((current) => ({ ...current, current: -1 })); toast("Obrigado pelo feedback."); }}>
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>
          {imageContext && <p className="assistant-image-understanding"><strong>Entendi sua imagem como:</strong> {imageContext}</p>}
          {(weeklyProgress || weeklyItems.length > 0) && <div className="discovery-week-plan" aria-label="Plano da semana">
            <div className="discovery-week-plan-head"><strong>Sua semana pronta para gravar</strong><span role="status">{weeklyProgress}</span></div>
            <div className="discovery-week-plan-days">{weeklyItems.map((item, index) => <article key={`${item.date}-${item.product.id}`} className="discovery-week-plan-day">
              <div className="discovery-week-plan-label"><span>Dia {index + 1} · {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).format(new Date(`${item.date}T12:00:00`))}</span><strong>{displayProductName(item.product)}</strong></div>
              {item.kit ? <><h3>{item.kit.titulo}</h3><pre>{kitCopyText(item.kit)}</pre><button type="button" onClick={() => { void copyText(kitCopyText(item.kit!)).then((copied) => toast(copied ? "Roteiro copiado." : "Não foi possível copiar. Selecione o texto do roteiro.")); }}>Copiar roteiro completo</button><button type="button" onClick={() => router.push(`/produtos/${item.product.id}/kits/${item.kit!.id}`)}>Abrir roteiro</button></> : <p>{item.error}</p>}
            </article>)}</div>
            {weeklyItems.length > 0 && <><button type="button" onClick={() => setWeeklyPlannerOpen(true)}>Editar produtos e datas</button></>}
            {weeklyLimit && <button type="button" onClick={() => setPlanLimitMessage("Seu plano chegou ao limite de roteiros ou conteúdos. Veja as opções para concluir os sete dias.")}>Ver limites do plano</button>}
          </div>}
          {!searching && <button type="button" className="sr-only" onClick={() => reset()}>Nova busca</button>}
          {!searching && comparedProducts.length > 0 && <div className="opportunity-comparison" aria-label="Comparação de produtos">
            <div className="opportunity-comparison-head"><div><strong>Comparação</strong><p>{comparedProducts.length === 1 ? "Selecione mais um produto para ver os dados lado a lado." : "Compare os dados antes de escolher seu roteiro."}</p></div><button type="button" onClick={() => setCompareIds([])}>Limpar</button></div>
            {comparedProducts.length === 2 && <div className="opportunity-comparison-grid">{comparedProducts.map((product) => <div key={product.id}><strong>{displayProductName(product)}</strong><dl><div><dt>Preço</dt><dd>{product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "—")}</dd></div><div><dt>Comissão estimada</dt><dd>{commissionOf(product) != null ? BRL.format(commissionOf(product)!) : "—"}</dd></div><div><dt>Vendas</dt><dd>{salesOf(product) >= 0 ? salesOf(product).toLocaleString("pt-BR") : "—"}</dd></div></dl><button type="button" onClick={() => setDetailsId(product.id)}>Ver detalhes <Icon name="arrow-right" size={15} /></button></div>)}</div>}
          </div>}
          {!searching && (
            <>
            <div className="product-grid-head">
              <strong>{topResults.length} {topResults.length === 1 ? "produto" : "produtos"} para gravar hoje</strong>
              <span>{sortBy === "vendas" ? "Ordenados por mais vendidos" : sortBy === "preco" ? "Ordenados por menor preço" : "Ordenados por maior comissão estimada"}</span>
            </div>
            <div className={`product-grid${topResults.length === 1 ? " is-single" : topResults.length === 2 ? " is-pair" : ""}${visibleResults.length < topResults.length ? " is-revealing" : ""}`}>
              {topResults.length ? (
                visibleResults.map((p, index) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    position={sortBy === "vendas" ? index + 1 : undefined}
                    saved={savedFor(p.id)}
                    saving={savingProductId === p.id}
                    highlightLabel={highlight?.id === p.id ? highlight.label : undefined}
                    onOpen={(id) => void startRecording(id)}
                    onPrefetch={prefetchProduct}
                    onSave={(id) => void saveProduct(id)}
                    onRemove={(id) => void removeSaved(id)}
                    onGenerate={(id) => void startRecording(id)}
                    busy={recordingProductId === p.id}
                    compared={compareIds.includes(p.id)}
                    onCompare={toggleCompare}
                  />
                ))
              ) : needsClarification ? null : (
                <div className="empty-state">
                  <h3>{error ? "A busca não foi dessa vez." : results.length && hideSensitive ? "Produtos ocultados pelo filtro." : "Não achei nada com esse filtro."}</h3>
                  <p>
                    {error
                      ? "Algo travou no caminho. Tenta de novo?"
                      : results.length && hideSensitive ? "Desative o filtro para ver todos os produtos desta busca." : "Tenta descrever de outro jeito ou me dá outra ideia."}
                  </p>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      if (error) { void search(lastSentQuery.current, false, undefined, lastSentAttachment.current); return; }
                      if (results.length && hideSensitive) {
                        setHideSensitive(false);
                        try { localStorage.setItem("temtrend-hide-sensitive", "false"); } catch {}
                        return;
                      }
                      reset();
                    }}
                  >
                    {error ? "Tentar novamente" : results.length && hideSensitive ? "Mostrar todos" : "Nova busca"}
                  </button>
                </div>
              )}
            </div>
            </>
          )}
          {!searching && topResults.length > 0 && (
            <div className="chat-quick-actions" aria-label="Ajustes rápidos da busca">
              <button type="button" onClick={() => { void search("Quero os produtos mais baratos", true); }}>Mais baratos</button>
              <button type="button" onClick={() => { void search("Quero os produtos com a maior comissão", true); }}>Maior comissão</button>
              <button
                type="button"
                onClick={() => {
                  setOpenFilter("Nicho");
                  filterBarRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
              >
                Outra categoria
              </button>
              <button type="button" onClick={() => { void startRecording(topResults[0].id); }}>Gerar roteiro do 1º</button>
            </div>
          )}
        </div>
      )}
      {searched && (
        <div className="discovery-dock">
          <div className="discovery-dock-inner">
            {composerForm}
            <p className="discovery-dock-note">O TemTrend pode cometer erros. Confira informações importantes.</p>
          </div>
        </div>
      )}
      {historyOpen && (
        <SearchHistoryDialog
          items={searchHistory}
          busyId={historyBusyId}
          clearing={historyClearing}
          error={historyError}
          onClose={() => setHistoryOpen(false)}
          onOpen={(id) => void openSavedSearch(id)}
          onDelete={(id) => void deleteSavedSearch(id)}
          onClear={() => void clearSavedSearches()}
        />
      )}
      {weeklyPlannerOpen && <WeeklyPlanner results={topResults} onClose={() => setWeeklyPlannerOpen(false)} />}
      {planLimitMessage && (
        <UpgradeDialog message={planLimitMessage} onClose={() => setPlanLimitMessage("")} />
      )}
      {detailsProduct && (
        <Modal titleId="product-details-title" onClose={() => setDetailsId(null)} className="product-details-dialog">
          <h2 id="product-details-title">{displayProductName(detailsProduct)}</h2>
          <div className="product-details-body">
            <ProductImage product={detailsProduct} className="product-image" />
            <div>
              <span className="product-category">{detailsProduct.categoria || "Produto"}</span>
              {detailsProduct.loja_nome && <p><strong>Loja:</strong> {detailsProduct.loja_nome}</p>}
              <dl className="opportunity-metrics">
                <div><dt>Preço</dt><dd>{detailsProduct.preco_texto || (detailsProduct.preco_min_brl != null ? BRL.format(detailsProduct.preco_min_brl) : "Não informado")}</dd></div>
                <div><dt>Comissão estimada</dt><dd>{commissionOf(detailsProduct) != null ? BRL.format(commissionOf(detailsProduct)!) : detailsProduct.comissao_percentual != null ? `${detailsProduct.comissao_percentual}%` : "Não informado"}</dd></div>
                <div><dt>Vendas</dt><dd>{salesOf(detailsProduct) >= 0 ? salesOf(detailsProduct).toLocaleString("pt-BR") : "Não informado"}</dd></div>
              </dl>
              {detailsProduct.descricao && <p>{detailsProduct.descricao}</p>}
              {videoReason(detailsProduct.motivo) && <p><strong>Por que considerar:</strong> {videoReason(detailsProduct.motivo)}</p>}
            </div>
          </div>
          <div className="share-link-actions">
            <button className="primary" type="button" disabled={recordingProductId === detailsProduct.id} onClick={() => { setDetailsId(null); void startRecording(detailsProduct.id); }}>Gravar conteúdo</button>
            {detailsProduct.tiktok_shop_url && <a className="ghost" href={detailsProduct.tiktok_shop_url} target="_blank" rel="noopener noreferrer">Ver na TikTok Shop</a>}
            <button className="ghost" type="button" onClick={() => setDetailsId(null)}>Fechar</button>
          </div>
        </Modal>
      )}
      {pendingDeleteTurn && (
        <Modal
          titleId="tt-delete-message-title"
          busy={deletingTurnId !== null}
          onClose={() => { if (deletingTurnId === null) setPendingDeleteTurn(null); }}
        >
          <div className="stack">
            <p className="eyebrow">Apagar mensagem</p>
            <h2 id="tt-delete-message-title">Apagar esta mensagem?</h2>
            <p className="muted">
              A pergunta e a resposta desta troca saem da conversa. Essa ação não pode ser desfeita.
            </p>
            <div className="tt-rail-dialog-actions">
              <button className="danger-button" type="button" disabled={deletingTurnId !== null} onClick={() => void confirmDeleteTurn()}>
                {deletingTurnId !== null ? "Apagando..." : "Apagar mensagem"}
              </button>
              <button className="ghost" type="button" disabled={deletingTurnId !== null} onClick={() => setPendingDeleteTurn(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
