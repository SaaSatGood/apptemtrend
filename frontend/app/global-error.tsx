"use client";

// Último recurso: o layout raiz falhou, então não há CSS global confiável.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#fbfaff", color: "#14101f" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <strong style={{ fontSize: 20, letterSpacing: "-0.02em" }}>TemTrend</strong>
            <h1 style={{ fontSize: 32, margin: "24px 0 12px" }}>Não conseguimos abrir a plataforma.</h1>
            <p style={{ color: "#5c556e", lineHeight: 1.6 }}>
              Seus dados continuam salvos. Recarregue a página; se o problema persistir, fale com o suporte.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 24,
                minHeight: 48,
                padding: "0 24px",
                border: "1px solid #6d28d9",
                borderRadius: 999,
                background: "#6d28d9",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
