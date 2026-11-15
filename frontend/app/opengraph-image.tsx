import { ImageResponse } from "next/og";

export const alt = "TemTrend — do produto ao roteiro, pronto para gravar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagem social gerada no build: sem arquivo pesado no repositório e sempre
// com a paleta atual da marca.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #f5f3fe 0%, #ede7fe 55%, #a894f9 100%)",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "#14101f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            T
          </div>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#14101f", letterSpacing: "-0.5px" }}>
            TemTrend
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "#5b21b6",
            }}
          >
            Do produto ao vídeo
          </span>
          <span
            style={{
              fontSize: 76,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-3px",
              color: "#14101f",
              maxWidth: 940,
            }}
          >
            Descubra o que vender. Receba o roteiro. Grave sem travar.
          </span>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Produtos reais", "Plano em 8 partes", "Produção organizada"].map((label) => (
            <span
              key={label}
              style={{
                display: "flex",
                padding: "12px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(20,16,31,0.12)",
                fontSize: 22,
                fontWeight: 600,
                color: "#14101f",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
