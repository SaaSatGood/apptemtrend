"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SIGNUP = "/app?mode=signup";

const EXAMPLES = [
  "Produto para academia",
  "Achadinho para casa",
  "Produto de beleza",
  "Fácil de demonstrar",
  "Até R$ 50",
  "Para presentear",
  "Para iniciantes",
  "Para o TikTok",
];

export default function LandingHero() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <div className="tt-discover-hero">
      <div className="tt-pill"><i /> DA IDEIA AO SEU PRÓXIMO VÍDEO</div>
      <h1>Descubra o que vale<br />a pena <em>vender.</em></h1>
      <p className="tt-discover-sub">Diga o que você procura ou deixe a TemTrend encontrar uma oportunidade para você.</p>
      <form
        className="tt-discover-form"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(SIGNUP);
        }}
      >
        <label htmlFor="landing-discover-input">O que você quer vender?</label>
        <div className="tt-discover-row">
          <input
            id="landing-discover-input"
            type="text"
            autoComplete="off"
            placeholder="Ex.: Quero um produto barato para demonstrar em 15 segundos"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="tt-btn" type="submit">
            Encontrar produtos <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
      <div className="tt-discover-chips" role="group" aria-label="Exemplos de busca">
        <span>Experimente:</span>
        {EXAMPLES.map((label) => (
          <Link key={label} href={SIGNUP}>{label}</Link>
        ))}
      </div>
      <Link className="tt-discover-surprise" href={SIGNUP}>Não sei o que vender →</Link>
      <p className="tt-discover-note">Produtos reais. Você escolhe a oportunidade, a TemTrend ajuda com o roteiro.</p>
      <small>Sem equipe. Sem experiência prévia. Sem começar do zero.</small>
    </div>
  );
}
