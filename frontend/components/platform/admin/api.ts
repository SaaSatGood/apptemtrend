import { api } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";

/** Uma leitura de sessão por render do painel: o token é reaproveitado nas abas. */
export async function adminToken(): Promise<string | undefined> {
  const session = await resolveSession();
  return session?.access_token;
}

export function adminGet<T>(path: string, accessToken?: string): Promise<T> {
  return api<T>(path, accessToken);
}

export function adminPost<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  return api<T>(path, accessToken, { method: "POST", body: JSON.stringify(body) });
}

export function adminPatch<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  return api<T>(path, accessToken, { method: "PATCH", body: JSON.stringify(body) });
}

/** Download autenticado (CSV) sem expor o token na URL. */
export async function adminDownload(path: string, filename: string, accessToken?: string): Promise<void> {
  const { requireApiUrl } = await import("@/lib/config");
  const response = await fetch(`${requireApiUrl()}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) throw new Error("Não foi possível gerar o arquivo.");
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
