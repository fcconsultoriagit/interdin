"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível iniciar a sessão.");

      router.replace("/painel");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível iniciar a sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="login-brand-mark"><ShieldCheck size={24} /></span>
        <div className="eyebrow">TJBA · SETIM</div>
        <h1>Acesse o InterDin</h1>
        <p>Entre com seu e-mail institucional e sua senha.</p>
        <form onSubmit={submit}>
          <label className="form-label" htmlFor="login-email">E-mail institucional</label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="form-label" htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
          />
          {error && <div className="feedback error-feedback" role="alert">{error}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
