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

async function fetchMeAndProductions(
  token: string
): Promise<{ me: MeResponse; productions: CreatorContent[] }> {
  const me = await api<MeResponse>("/me", token);
  let productions: CreatorContent[] = [];
  if (!me.is_admin && me.onboarding_completo) {
    productions = await api<CreatorContent[]>("/creator-content", token);
  }
  return { me, productions };
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [booted, setBooted] = useState(false);
  const [productions, setProductions] = useState<CreatorContent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const bootedRef = useRef(false);

  const toast = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const loadProductions = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return;
    const list = await api<CreatorContent[]>("/creator-content", data.session.access_token);
    setProductions(list);
  }, []);

  const reloadMe = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return;
    try {
      const result = await fetchMeAndProductions(data.session.access_token);
      setMe(result.me);
      setProductions(result.productions);
      setGlobalError(null);
    } catch (error) {
      setGlobalError(friendlyError(error, "Não conseguimos carregar sua conta. Tente novamente."));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase().auth.signOut({ scope: "local" });
    } finally {
      setSession(null);
      setMe(null);
      try {
        window.localStorage.removeItem("temtrend_onboarding");
      } catch {
        /* noop */
      }
      window.location.replace("/app?loggedout=1");
    }
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    let mounted = true;
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        try {
          const result = await fetchMeAndProductions(data.session.access_token);
          if (!mounted) return;
          setMe(result.me);
          setProductions(result.productions);
        } catch (error) {
          if (mounted) {
            setGlobalError(
              friendlyError(error, "Não conseguimos carregar sua conta. Tente novamente.")
            );
          }
        }
      }
      if (mounted) setBooted(true);
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
  }, []);

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
      toasts,
      toast,
      reloadMe,
      loadProductions,
      signOut,
    }),
    [session, me, booted, globalError, productions, toasts, toast, reloadMe, loadProductions, signOut]
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
