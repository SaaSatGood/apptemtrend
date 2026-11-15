"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@/lib/supabase";
import { e2eHookSession, hasRecoveryIntent, clearRecoveryIntent, resolveSession, supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { primeProductDetail } from "@/lib/product-detail-cache";
import type { CreatorContent, MeResponse } from "@/lib/types";

interface ToastItem {
  id: number;
  message: string;
}

interface PlatformState {
  session: Session | null;
  me: MeResponse | null;
  meLoading: boolean;
  booted: boolean;
  globalError: string | null;
  recoveryMode: boolean;
  clearRecovery: () => void;
  admin: boolean;
  onboardingActive: boolean;
  productions: CreatorContent[];
  productionsLoading: boolean;
  productionsError: boolean;
  toasts: ToastItem[];
  toast: (message: string) => void;
  reloadMe: () => Promise<void>;
  loadProductions: () => Promise<void>;
  signOut: () => Promise<void>;
}

const PlatformContext = createContext<PlatformState | null>(null);

export function usePlatform(): PlatformState {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform fora do PlatformProvider");
  return ctx;
}

let toastId = 0;

const PRODUCTION_PAGE_LIMIT = 50;
const PRODUCTION_MAX_PAGES = 20;
const PRODUCTION_CONCURRENCY = 4;

function fetchProductionPage(token: string, page: number): Promise<CreatorContent[]> {
  return api<CreatorContent[]>(
    `/creator-content?page=${page}&limit=${PRODUCTION_PAGE_LIMIT}`,
    token
  );
}

// A primeira página pinta a tela na hora; as demais chegam em segundo plano,
// em lotes, sem segurar a casca do app. `onPage` recebe a lista acumulada e
// só é chamado enquanto `isCurrent()` continuar verdadeiro (evita resposta
// antiga sobrescrevendo uma lista mais nova).
async function fetchProductionsProgressively(
  token: string,
  onPage: (all: CreatorContent[], added: CreatorContent[]) => void,
  isCurrent: () => boolean
): Promise<CreatorContent[]> {
  const first = await fetchProductionPage(token, 1);
  const all: CreatorContent[] = [...first];
  onPage([...all], first);
  if (first.length < PRODUCTION_PAGE_LIMIT) return all;
  for (let start = 2; start <= PRODUCTION_MAX_PAGES; start += PRODUCTION_CONCURRENCY) {
    if (!isCurrent()) return all;
    const pages = Array.from(
      { length: Math.min(PRODUCTION_CONCURRENCY, PRODUCTION_MAX_PAGES - start + 1) },
      (_, i) => start + i
    );
    const batches = await Promise.all(
      pages.map((page) => fetchProductionPage(token, page))
    );
    if (!isCurrent()) return all;
    let stop = false;
    const added: CreatorContent[] = [];
    for (const batch of batches) {
      added.push(...batch);
      if (batch.length < PRODUCTION_PAGE_LIMIT) stop = true;
    }
    all.push(...added);
    onPage([...all], added);
    if (stop) break;
  }
  return all;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Produtos e roteiros já chegam na lista de produção. Aproveitamos esses
// dados para abrir produto/roteiro instantaneamente, revalidando depois.
function primeProductDetails(list: CreatorContent[]) {
  for (const item of list) {
    if (item.products && item.content_kits) {
      primeProductDetail(item.products, item.content_kits);
    }
  }
}

function isRetryableStatus(status: number | undefined): boolean {
  // 401 NÃO é retryable: token expirado/inválido se resolve com 1x
  // refreshSession em loadMeForSession, não com retry cego (evita 3x /me).
  // undefined = falha de rede/timeout: tenta de novo com backoff.
  if (status === undefined) return true;
  if (status === 401) return false;
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

async function fetchMeWithRetry(token: string, attempts = 3): Promise<MeResponse> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      // O primeiro request pode pegar o backend dormindo (Render Free). Dá
      // mais tempo só na primeira tentativa; as seguintes usam o teto normal.
      return await api<MeResponse>("/me", token, attempt === 0 ? { timeoutMs: 45_000 } : undefined);
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number })?.status;
      const retryable = isRetryableStatus(status);
      if (!retryable || attempt === attempts - 1) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  // Link de recuperação de senha: precisa sobreviver ao initialize do GoTrue,
  // que apaga o hash da URL antes da casca do app montar.
  const [recoveryMode, setRecoveryMode] = useState(() => hasRecoveryIntent());
  const [productions, setProductions] = useState<CreatorContent[]>([]);
  const [productionsLoading, setProductionsLoading] = useState(false);
  const [productionsError, setProductionsError] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const meRef = useRef<MeResponse | null>(null);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  // Single-flight por userId: boot + INITIAL_SESSION + pageshow não
  // disparam /me em paralelo; chamadas concorrentes aguardam a mesma promise.
  // Evita rajadas de GET /me + refresh em login/OAuth/aba restaurada.
  const fetchingForRef = useRef<string | null>(null);
  const fetchingPromiseRef = useRef<Map<string, Promise<void>>>(new Map());
  const productionsRequestRef = useRef(0);

  const toast = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const loadProductions = useCallback(async () => {
    const session = await resolveSession();
    if (!session) return;
    const requestId = ++productionsRequestRef.current;
    const isCurrent = () => requestId === productionsRequestRef.current;
    setProductionsLoading(true);
    setProductionsError(false);
    try {
      await fetchProductionsProgressively(
        session.access_token,
        (all, added) => {
          if (!isCurrent()) return;
          primeProductDetails(added);
          setProductions(all);
        },
        isCurrent
      );
    } catch (error) {
      if (isCurrent()) setProductionsError(true);
      throw error;
    } finally {
      if (isCurrent()) setProductionsLoading(false);
    }
  }, []);

  const loadMeForSession = useCallback(
    async (activeSession: Session, options: { force?: boolean } = {}) => {
      const userId = activeSession.user.id;
      // Se já temos o perfil deste usuário e não é recarga forçada, nada a fazer.
      if (!options.force && meRef.current?.user_id === userId) return;
      const inFlight = fetchingPromiseRef.current.get(userId);
      if (!options.force && inFlight) {
        await inFlight;
        return;
      }
      if (!options.force && fetchingForRef.current === userId) return;
      fetchingForRef.current = userId;
      setMeLoading(true);
      const task = (async () => {
      let token = activeSession.access_token;
      let profile: MeResponse | null = null;
      try {
        try {
          profile = await fetchMeWithRetry(token);
        } catch (error) {
          // Token pode ter expirado entre getSession e /me: renova uma vez
          // antes de declarar falha (cobre o "logado mas sem conta").
          const status = (error as { status?: number })?.status;
          if (status === 401) {
            try {
              const { data } = await supabase().auth.refreshSession();
              if (data.session) {
                setSession(data.session);
                token = data.session.access_token;
                profile = await fetchMeWithRetry(token, 2);
              } else {
                throw error;
              }
            } catch {
              throw error;
            }
          } else {
            throw error;
          }
        }
        setMe(profile!);
        meRef.current = profile!;
        setGlobalError(null);
      } catch (error) {
        setGlobalError(friendlyError(error, "Não conseguimos carregar sua conta. Tente novamente."));
        throw error;
      } finally {
        if (fetchingForRef.current === userId) fetchingForRef.current = null;
        setMeLoading(false);
      }
      // Produção carrega em segundo plano: a casca aparece logo após o /me,
      // sem esperar a paginação completa. O requestId evita que uma resposta
      // antiga sobrescreva uma lista mais nova.
      if (!profile || profile.is_admin || !profile.onboarding_completo) {
        productionsRequestRef.current += 1;
        setProductions([]);
        setProductionsError(false);
        setProductionsLoading(false);
        return;
      }
      const productionRequestId = ++productionsRequestRef.current;
      const isCurrent = () =>
        meRef.current?.user_id === userId &&
        productionRequestId === productionsRequestRef.current;
      setProductionsError(false);
      setProductionsLoading(true);
      void (async () => {
        try {
          await fetchProductionsProgressively(
            token,
            (all, added) => {
              if (!isCurrent()) return;
              primeProductDetails(added);
              setProductions(all);
            },
            isCurrent
          );
        } catch {
          if (isCurrent()) {
            setProductionsError(true);
            toast("Sua conta abriu, mas a produção não pôde ser atualizada.");
          }
        } finally {
          if (isCurrent()) setProductionsLoading(false);
        }
      })();
      })();
      fetchingPromiseRef.current.set(userId, task);
      try {
        await task;
      } finally {
        if (fetchingPromiseRef.current.get(userId) === task) {
          fetchingPromiseRef.current.delete(userId);
        }
      }
    },
    [toast]
  );

  const reloadMe = useCallback(async () => {
    const session = await resolveSession();
    if (!session) return;
    setSession(session);
    try {
      await loadMeForSession(session, { force: true });
    } catch (error) {
      // globalError já foi definido em loadMeForSession; propaga para o
      // chamador (AccountLoadError) exibir o erro de retry.
      throw error;
    }
  }, [loadMeForSession]);

  const clearRecovery = useCallback(() => {
    clearRecoveryIntent();
    setRecoveryMode(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase().auth.signOut({ scope: "local" });
    } finally {
      clearRecoveryIntent();
      setRecoveryMode(false);
      setSession(null);
      setMe(null);
      meRef.current = null;
      fetchingForRef.current = null;
      try {
        window.localStorage.removeItem("temtrend_onboarding");
        if (session?.user.id) window.localStorage.removeItem(`temtrend_onboarding:${session.user.id}`);
      } catch {
        /* noop */
      }
      window.location.replace("/descobrir?loggedout=1");
    }
  }, [session?.user.id]);

  useEffect(() => {
    let mounted = true;
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
      ]);
    (async () => {
      // Warmup best-effort: acorda o backend (cold start) enquanto o usuário
      // ainda está no boot/login, sem segurar nenhuma tela.
      try {
        const { requireApiUrl } = await import("@/lib/config");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        fetch(requireApiUrl() + "/health", { signal: controller.signal, cache: "no-store" })
          .catch(() => {})
          .finally(() => clearTimeout(timer));
      } catch {
        /* sem API configurada: nada a aquecer */
      }
      try {
        const session = await withTimeout(resolveSession(), 8000);
        if (!mounted) return;
        setSession(session);
        if (session) {
          try {
            await loadMeForSession(session);
          } catch {
            // globalError já definido; a tela oferece "Tentar novamente".
          }
        }
      } catch (error) {
        if (mounted) {
          setGlobalError(
            friendlyError(error, "Não conseguimos iniciar a sessão. Verifique sua internet e recarregue.")
          );
        }
      } finally {
        if (mounted) setBooted(true);
      }
    })();
    // Sessão que chega DEPOIS do boot (login recente, OAuth, refresh ou
    // aba restaurada) precisa buscar o perfil — antes este listener só
    // atualizava `session`, deixando `me === null` e caindo na tela
    // "Não conseguimos carregar sua conta" mesmo logado.
    const { data: listener } = supabase().auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      } else if (event === "SIGNED_IN") {
        clearRecoveryIntent();
        setRecoveryMode(false);
      }
      // No boot, o cliente pode emitir INITIAL_SESSION null antes de ler o
      // storage (ou no E2E, onde a sessão vem do hook): não derrubar o estado.
      const effective = newSession ?? (event === "INITIAL_SESSION" ? e2eHookSession() : null);
      setSession(effective);
      if (event === "SIGNED_OUT" || !effective) {
        setMe(null);
        meRef.current = null;
        setProductions([]);
        fetchingForRef.current = null;
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        if (!meRef.current || meRef.current.user_id !== effective.user.id) {
          void loadMeForSession(effective).catch(() => {
            /* globalError já definido */
          });
        }
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadMeForSession, toast]);

  useEffect(() => {
    const onPageshow = async () => {
      try {
        const session = await resolveSession();
        setSession(session);
        if (!session) {
          setMe(null);
          meRef.current = null;
          return;
        }
        // Aba restaurada do bfcache pode ter sessão válida mas perfil
        // ausente/antigo: garante o carregamento em vez de mostrar erro.
        if (!meRef.current || meRef.current.user_id !== session.user.id) {
          void loadMeForSession(session).catch(() => {
            /* globalError já definido */
          });
        }
      } catch {
        /* mantém estado atual; próximo retry cobre */
      }
    };
    window.addEventListener("pageshow", onPageshow);
    return () => window.removeEventListener("pageshow", onPageshow);
  }, [loadMeForSession]);

  const value = useMemo<PlatformState>(
    () => ({
      session,
      me,
      meLoading,
      booted,
      globalError,
      recoveryMode,
      clearRecovery,
      admin: me?.is_admin === true,
      onboardingActive: Boolean(session && me && !me.onboarding_completo && !me.is_admin),
      productions,
      productionsLoading,
      productionsError,
      toasts,
      toast,
      reloadMe,
      loadProductions,
      signOut,
    }),
    [session, me, meLoading, booted, globalError, recoveryMode, clearRecovery, productions, productionsLoading, productionsError, toasts, toast, reloadMe, loadProductions, signOut]
  );

  return (
    <PlatformContext.Provider value={value}>
      {children}
      <div aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="status">
            {t.message}
          </div>
        ))}
      </div>
    </PlatformContext.Provider>
  );
}
