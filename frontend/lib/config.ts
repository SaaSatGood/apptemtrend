export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const BUILD_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

let cachedApiUrl: string | null = null;

// Runtime override (localStorage/meta) é input não confiável: sem validação,
// um valor envenenado desvia fetch com Authorization para host atacante.
// Allowlist: localhost (dev), mesma origem da página, ou host do build.
function isTrustedApiUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return true;
  if (typeof window !== "undefined" && host === window.location.hostname.toLowerCase()) return true;
  if (BUILD_API_URL) {
    try {
      if (host === new URL(BUILD_API_URL).hostname.toLowerCase()) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function pickTrustedUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  const url = raw.trim();
  if (!url || !isTrustedApiUrl(url)) return "";
  return url;
}

function resolveApiUrl(): string {
  if (cachedApiUrl) return cachedApiUrl;
  let url = "";
  if (typeof window !== "undefined") {
    const stored = pickTrustedUrl(window.localStorage.getItem("temtrend_api_url"));
    if (stored) url = stored;
    else {
      // Remove override envenenado para não desviar token no próximo boot.
      if (window.localStorage.getItem("temtrend_api_url")?.trim()) {
        try {
          window.localStorage.removeItem("temtrend_api_url");
        } catch {
          /* noop */
        }
      }
      const meta = pickTrustedUrl(
        document.querySelector('meta[name="temtrend-api-url"]')?.getAttribute("content")
      );
      if (meta) url = meta;
      else if (LOCAL_HOSTS.has(window.location.hostname)) url = "http://localhost:3333";
    }
  } else {
    url = BUILD_API_URL;
  }
  if (url) cachedApiUrl = url;
  return url || BUILD_API_URL;
}

export function clearApiUrlCacheForTests() {
  cachedApiUrl = null;
}

export const API_URL = resolveApiUrl();

export function requireApiUrl(): string {
  const url =
    typeof window !== "undefined"
      ? resolveApiUrl()
      : process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  if (!url) {
    throw new Error(
      "Serviço indisponível. Configure NEXT_PUBLIC_API_URL ou localStorage temtrend_api_url."
    );
  }
  return url;
}
