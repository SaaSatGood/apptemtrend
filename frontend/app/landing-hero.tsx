"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SIGNUP = "/app?mode=signup";

function signupWithSearch(search: string) {
  const query = search.trim();
  return query ? `${SIGNUP}&search=${encodeURIComponent(query)}` : SIGNUP;
}

function rememberSearch(search: string) {
  try { sessionStorage.setItem("temtrend_pending_search", search.trim()); } catch { /* armazenamento opcional */ }
}

const EXAMPLES = [
  "Produto para academia",
  "Achadinho para casa",
  "Produto de beleza",
  "Fácil de demonstrar",
  "Até R$ 50",
];

export default function LandingHero() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <div className="tt-discover-hero">
      <h1><span>Descubra o que</span><span>vale a pena</span><em>vender.</em></h1>
      <p className="tt-discover-sub">Encontre produtos para vender e transforme cada escolha em um plano de gravação.</p>
      <form
        className="tt-discover-form"
        onSubmit={(e) => {
          e.preventDefault();
          rememberSearch(value);
          router.push(signupWithSearch(value));
        }}
      >
        <label htmlFor="landing-discover-input">O que você quer vender?</label>
        <div className="tt-discover-row">
          <input
            id="landing-discover-input"
            name="search"
            type="text"
            autoComplete="off"
            maxLength={500}
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
          <Link key={label} href={signupWithSearch(label)} onClick={() => rememberSearch(label)}>{label}</Link>
        ))}
      </div>
      <Link className="tt-discover-surprise" href={SIGNUP}>Não sei o que vender →</Link>
      <p className="tt-discover-note">Produtos reais. Você escolhe a oportunidade, a TemTrend ajuda com o roteiro.</p>
      <small>Sem equipe. Sem experiência prévia. Sem começar do zero.</small>
    </div>
  );
}
