import { requireApiUrl } from "./config";

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

// Teto por tentativa: sem timeout, um backend adormecido (cold start)
// deixava o boot no spinner para sempre. Estourou → erro com retry.
const API_TIMEOUT_MS = 12000;

export async function api<T>(
  path: string,
  accessToken: string | undefined,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  // Content-Type só com corpo: Fastify rejeita DELETE/GET com o header e sem body (400).
  if (options.body != null && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers as Record<string, string>)) {
      headers[k] = v;
    }
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(requireApiUrl() + path, { ...options, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A resposta demorou demais. Tente novamente.");
    }
    throw new Error("Não foi possível conectar. Verifique sua internet.");
  } finally {
    clearTimeout(timer);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(
      data?.error?.message ?? "Não conseguimos concluir agora. Tente novamente."
    ) as ApiError;
    error.code = data?.error?.code;
    error.status = res.status;
    throw error;
  }
  return data as T;
}

export function friendlyError(error: unknown, fallback: string): string {
  const message = String((error as { message?: unknown })?.message ?? "").trim();
  if (!message) return fallback;
  if (
    /failed to fetch|networkerror|typeerror|internal|supabase|gemini|econn|undefined|cannot read|\bnull\b|erro\s*\d|status code 5|stack trace/i.test(
      message
    )
  ) {
    return fallback;
  }
  return message;
}

export function humanAuthError(error: unknown): string {
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (message.includes("user already registered") || message.includes("already been registered"))
    return "Este email já possui uma conta.";
  if (message.includes("password should be")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (message.includes("provider is not enabled") || message.includes("provider not enabled"))
    return "Este login social ainda não foi ativado. Tente outro provedor ou entre com email.";
  if (message.includes("popup closed") || message.includes("cancelled") || message.includes("canceled"))
    return "Login cancelado. Tente novamente quando quiser.";
  if (message.includes("rate limit") || message.includes("too many"))
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (message.includes("expired") || message.includes("invalid token"))
    return "Este link expirou. Solicite um novo.";
  if (message.includes("network") || message.includes("fetch"))
    return "Não foi possível conectar. Verifique sua internet.";
  return "Não foi possível concluir agora. Tente novamente.";
}
