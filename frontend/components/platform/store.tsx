"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
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

async function fetchAllProductions(token: string): Promise<CreatorContent[]> {
  const all: CreatorContent[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const batch = await api<CreatorContent[]>(
      `/creator-content?page=${page}&limit=50`,
      token
    );
    all.push(...batch);
    if (batch.length < 50) break;
  }
  return all;
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [booted, setBooted] = useState(false);
  const [productions, setProductions] = useState<CreatorContent[]>([]);
  const [productionsLoading, setProductionsLoading] = useState(false);
  const [productionsError, setProductionsError] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const toast = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const loadProductions = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return;
    setProductionsLoading(true);
    setProductionsError(false);
    try {
      const list = await fetchAllProductions(data.session.access_token);
      setProductions(list);
    } catch (error) {
      setProductionsError(true);
      throw error;
    } finally {
      setProductionsLoading(false);
    }
  }, []);

  const reloadMe = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return;
    try {
      const profile = await api<MeResponse>("/me", data.session.access_token);
      setMe(profile);
      setGlobalError(null);
      if (!profile.is_admin && profile.onboarding_completo) {
        void loadProductions().catch(() => {
          toast("Não conseguimos atualizar sua produção agora.");
        });
      } else {
        setProductions([]);
      }
    } catch (error) {
      setGlobalError(friendlyError(error, "Não conseguimos carregar sua conta. Tente novamente."));
      throw error;
    }
  }, [loadProductions, toast]);

  const signOut = useCallback(async () => {
    try {
      await supabase().auth.signOut({ scope: "local" });
    } finally {
      setSession(null);
      setMe(null);
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
        const { data } = await withTimeout(supabase().auth.getSession(), 8000);
        if (!mounted) return;
        setSession(data.session);
        if (data.session) {
          try {
            const profile = await withTimeout(
              api<MeResponse>("/me", data.session.access_token),
              10000
            );
            if (!mounted) return;
            setMe(profile);
            if (!profile.is_admin && profile.onboarding_completo) {
              setProductionsLoading(true);
              void fetchAllProductions(data.session.access_token)
                .then((list) => {
                  if (mounted) setProductions(list);
                })
                .catch(() => {
                  if (mounted) setProductionsError(true);
                  if (mounted) toast("Sua conta abriu, mas a produção não pôde ser atualizada.");
                })
                .finally(() => {
                  if (mounted) setProductionsLoading(false);
                });
            }
          } catch (error) {
            if (mounted) {
              setGlobalError(
                friendlyError(error, "Não conseguimos carregar sua conta. Tente novamente.")
              );
            }
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
    const { data: listener } = supabase().auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_OUT") {
        setMe(null);
        setProductions([]);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [toast]);

  useEffect(() => {
    const onPageshow = async () => {
      const { data } = await supabase().auth.getSession();
      setSession(data.session);
      if (!data.session) setMe(null);
    };
    window.addEventListener("pageshow", onPageshow);
    return () => window.removeEventListener("pageshow", onPageshow);
  }, []);

  const value = useMemo<PlatformState>(
    () => ({
      session,
      me,
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
    [session, me, booted, globalError, productions, productionsLoading, productionsError, toasts, toast, reloadMe, loadProductions, signOut]
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
