"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/track";

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
      <span className="tt-discover-kicker">Para creators do TikTok Shop</span>
      <h1>Encontre o produto certo.</h1>
      <p className="tt-discover-sub">Compare oportunidades para seu próximo vídeo e transforme a escolha em um plano de gravação, cena por cena.</p>
      <form
        className="tt-discover-form"
        onSubmit={(e) => {
          e.preventDefault();
          rememberSearch(value);
          track("landing_search", { source: "form", q_len: value.trim().length });
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
            Encontrar produtos
          </button>
        </div>
      </form>
    </div>
  );
}

export function LandingExamples() {
  return (
    <div className="tt-discover-chips" role="group" aria-label="Exemplos de busca">
      <span>Comece com uma ideia:</span>
      {EXAMPLES.map((label) => (
        <Link key={label} href={signupWithSearch(label)} onClick={() => { rememberSearch(label); track("landing_search", { source: "chip" }); }}>{label}</Link>
      ))}
      <Link className="tt-discover-surprise" href={SIGNUP} onClick={() => track("landing_search", { source: "surprise" })}>Não sei o que vender</Link>
    </div>
  );
}
