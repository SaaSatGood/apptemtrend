export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("temtrend_api_url")?.trim();
    if (stored) return stored;
    const meta = document
      .querySelector('meta[name="temtrend-api-url"]')
      ?.getAttribute("content")
      ?.trim();
    if (meta) return meta;
    if (LOCAL_HOSTS.has(window.location.hostname)) return "http://localhost:3333";
  }
  return process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
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
