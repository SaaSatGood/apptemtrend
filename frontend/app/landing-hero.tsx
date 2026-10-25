"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { track } from "@/lib/track";

const SIGNUP = "/app/descobrir?mode=signup";

function signupWithSearch(search: string) {
  const query = search.trim();
  return query ? `${SIGNUP}&search=${encodeURIComponent(query)}` : SIGNUP;
}

function rememberSearch(search: string) {
  try { sessionStorage.setItem("temtrend_pending_search", search.trim()); } catch { /* armazenamento opcional */ }
}

export default function LandingHero() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <div className="tt-lp-search-block">
      <form
        className="tt-lp-search"
        onSubmit={(event) => {
          event.preventDefault();
          rememberSearch(value);
          track("landing_search", { source: "form", q_len: value.trim().length });
          router.push(signupWithSearch(value));
        }}
      >
        <label className="tt-lp-sr-only" htmlFor="landing-discover-input">O que você quer vender?</label>
        <div className="tt-lp-search-row">
          <span className="tt-lp-search-icon" aria-hidden="true">
            <Icon name="search" size={20} />
          </span>
          <input
            id="landing-discover-input"
            name="search"
            type="text"
            autoComplete="off"
            maxLength={500}
            placeholder="Ex.: garrafa térmica para vídeo"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button className="tt-lp-btn tt-lp-btn-lime tt-lp-search-submit" type="submit">
            Encontrar produtos
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      </form>
      <div className="tt-lp-search-note">
        <span><i aria-hidden="true"><Icon name="check" size={10} /></i> 3 pesquisas e 3 roteiros grátis</span>
        <span>Sem cartão</span>
        <Link href={SIGNUP} onClick={() => track("landing_search", { source: "direct" })}>
          Começar agora <Icon name="arrow-right" size={14} />
        </Link>
      </div>
    </div>
  );
}
