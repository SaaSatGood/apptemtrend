"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Icon from "@/components/ui/Icon";
import { api, friendlyError } from "@/lib/api";

const BENEFITS = [
  {
    title: "Presença no catálogo",
    text: "Seu produto aparece nas buscas de quem procura oportunidades para criar conteúdo.",
  },
  {
    title: "Visibilidade para creators",
    text: "Entre no fluxo de descoberta da TemTrend.",
  },
  {
    title: "Curadoria especializada",
    text: "Nossa equipe revisa as informações antes de disponibilizar o produto.",
  },
];

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  mensagem: string;
};

const EMPTY_FORM: FormState = {
  nome: "",
  email: "",
  telefone: "",
  mensagem: "",
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function LandingPartners() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      await api("/brand-leads", undefined, {
        method: "POST",
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          mensagem: form.mensagem.trim(),
        }),
      });
      setSent(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(friendlyError(err, "Não conseguimos enviar agora. Tente de novo em instantes."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="tt-lp-cta" id="para-marcas" aria-labelledby="cta-title">
      <div className="tt-lp-cta-inner" data-reveal>
        <div className="tt-lp-cta-copy">
          <span className="tt-lp-kicker">Para marcas e lojistas</span>
          <h2 id="cta-title">
            Seu produto no radar de quem <em>grava todo dia.</em>
          </h2>
          <p>
            Coloque sua marca no caminho de creators que estão procurando
            produtos para transformar em conteúdo e vendas.
          </p>
          <ol className="tt-lp-cta-points">
            {BENEFITS.map((benefit, index) => (
              <li key={benefit.title}>
                <span className="tt-lp-cta-point-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <strong>{benefit.title}</strong>
                  <p>{benefit.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="tt-lp-cta-note">
            Preencha o formulário e o time responde por e-mail com os
            próximos passos.
          </p>
        </div>

          <div className="tt-lp-lead">
            {sent ? (
              <div className="tt-lp-lead-sent" role="status">
                <span className="tt-lp-lead-sent-icon" aria-hidden="true">
                  <Icon name="check-circle" size={22} />
                </span>
                <h3>Recebemos seu cadastro.</h3>
                <p>
                  O time da TemTrend vai responder no e-mail informado com os
                  próximos passos. Se quiser adiantar, é só responder com o
                  link do seu catálogo.
                </p>
                <button
                  type="button"
                  className="tt-lp-lead-again"
                  onClick={() => setSent(false)}
                >
                  Enviar outro cadastro
                </button>
              </div>
            ) : (
              <form className="tt-lp-lead-form" onSubmit={handleSubmit}>
                <div className="tt-lp-lead-head">
                  <h3>Cadastre seus produtos</h3>
                  <p>Conte um pouco sobre a sua marca. É rápido.</p>
                </div>

                <div className="tt-lp-lead-grid">
                  <label className="tt-lp-lead-field is-wide">
                    <span>Seu nome</span>
                    <input
                      type="text"
                      name="nome"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={80}
                      value={form.nome}
                      onChange={(event) => update("nome", event.target.value)}
                      placeholder="Nome e sobrenome"
                    />
                  </label>

                  <label className="tt-lp-lead-field">
                    <span>E-mail</span>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      maxLength={160}
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="voce@empresa.com"
                    />
                  </label>

                  <label className="tt-lp-lead-field">
                    <span>Telefone</span>
                    <input
                      type="tel"
                      name="telefone"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      value={form.telefone}
                      onChange={(event) => update("telefone", formatPhone(event.target.value))}
                      placeholder="(11) 99999-9999"
                    />
                  </label>

                  <label className="tt-lp-lead-field is-wide">
                    <span>Mensagem</span>
                    <textarea
                      name="mensagem"
                      rows={3}
                      required
                      minLength={5}
                      maxLength={1000}
                      value={form.mensagem}
                      onChange={(event) => update("mensagem", event.target.value)}
                      placeholder="Conte o que você vende e o que quer cadastrar."
                    />
                  </label>
                </div>

                {error ? (
                  <p className="tt-lp-lead-error" role="alert">
                    {error}
                  </p>
                ) : null}

                <button className="tt-lp-lead-submit" type="submit" disabled={sending}>
                  {sending ? "Enviando..." : "Enviar cadastro"}
                  {sending ? null : <Icon name="arrow-right" size={18} />}
                </button>

                <p className="tt-lp-lead-privacy">
                  Usamos seus dados apenas para falar sobre o cadastro do
                  catálogo. Sem newsletter automática.
                </p>
              </form>
            )}
          </div>
        </div>
    </section>
  );
}
