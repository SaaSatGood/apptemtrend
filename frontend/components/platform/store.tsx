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
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
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

// Sessão ativa: em produção vem da memória (persistSession: false).
// Em E2E (NEXT_PUBLIC_E2E=1), o spec injeta via window.__TT_E2E_SESSION__
// porque localStorage é ignorado sem persistência.
function e2eHookSession(): Session | null {
  if (process.env.NEXT_PUBLIC_E2E !== "1" || typeof window === "undefined") return null;
  return (window as unknown as { __TT_E2E_SESSION__?: Session }).__TT_E2E_SESSION__ ?? null;
}

async function resolveSession(): Promise<Session | null> {
  return e2eHookSession() ?? (await supabase().auth.getSession()).data.session;
}

async function fetchAllProductions(token: string): Promise<CreatorContent[]> {
  const PAGE_LIMIT = 50;
  const MAX_PAGES = 20;
  const CONCURRENCY = 4;
  const first = await api<CreatorContent[]>(
    `/creator-content?page=1&limit=${PAGE_LIMIT}`,
    token
  );
  if (first.length < PAGE_LIMIT) return first;
  const all: CreatorContent[] = [...first];
  for (let start = 2; start <= MAX_PAGES; start += CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(CONCURRENCY, MAX_PAGES - start + 1) },
      (_, i) => start + i
    );
    const batches = await Promise.all(
      pages.map((page) =>
        api<CreatorContent[]>(`/creator-content?page=${page}&limit=${PAGE_LIMIT}`, token)
      )
    );
    let stop = false;
    for (const batch of batches) {
      all.push(...batch);
      if (batch.length < PAGE_LIMIT) stop = true;
    }
    if (stop) break;
  }
  return all;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      return await api<MeResponse>("/me", token);
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

  const toast = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const loadProductions = useCallback(async () => {
    const session = await resolveSession();
    if (!session) return;
    setProductionsLoading(true);
    setProductionsError(false);
    try {
      const list = await fetchAllProductions(session.access_token);
      setProductions(list);
    } catch (error) {
      setProductionsError(true);
      throw error;
    } finally {
      setProductionsLoading(false);
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
      try {
        let token = activeSession.access_token;
        let profile: MeResponse;
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
        if (!profile!.is_admin && profile!.onboarding_completo) {
          setProductionsLoading(true);
          try {
            const list = await fetchAllProductions(token);
            setProductions(list);
          } catch {
            setProductionsError(true);
            toast("Sua conta abriu, mas a produção não pôde ser atualizada.");
          } finally {
            setProductionsLoading(false);
          }
        } else {
          setProductions([]);
        }
      } catch (error) {
        setGlobalError(friendlyError(error, "Não conseguimos carregar sua conta. Tente novamente."));
        throw error;
      } finally {
        if (fetchingForRef.current === userId) fetchingForRef.current = null;
        setMeLoading(false);
      }
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

  const signOut = useCallback(async () => {
    try {
      await supabase().auth.signOut({ scope: "local" });
    } finally {
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
      window.location.replace("/app?loggedout=1");
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
      // Sem persistência, o cliente emite INITIAL_SESSION null mesmo com
      // sessão ativa em memória/E2E: não derrubar o estado nesse caso.
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
    [session, me, meLoading, booted, globalError, productions, productionsLoading, productionsError, toasts, toast, reloadMe, loadProductions, signOut]
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
