"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, CircleAlert, LoaderCircle, MapPin, X } from "lucide-react";

type Invitation = {
  participante: {
    nome: string;
    confirmacao: string;
    agenda: { titulo: string; dataHora: string; localOuLink: string | null; status: string };
  };
};

export function MeetingRsvpPage({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation["participante"] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/reunioes/confirmar?token=${encodeURIComponent(token)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as Invitation & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar o convite.");
        setInvitation(result.participante);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o convite.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  async function respond(confirmacao: "CONFIRMADO" | "RECUSADO") {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/reunioes/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, confirmacao }),
      });
      const result = await response.json() as { participante?: { nome: string; confirmacao: string }; error?: string };
      if (!response.ok || !result.participante) throw new Error(result.error ?? "Não foi possível registrar sua resposta.");
      if (invitation) setInvitation({ ...invitation, confirmacao: result.participante.confirmacao });
      setMessage(confirmacao === "CONFIRMADO" ? "Presença confirmada com sucesso." : "Resposta de recusa registrada.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível registrar sua resposta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="meeting-rsvp-page">
      <section className="meeting-rsvp-card">
        <div className="meeting-rsvp-mark"><CalendarDays size={23} /></div>
        <p className="eyebrow">INTERDIN · TJBA</p>
        {loading ? <p className="meeting-rsvp-muted"><LoaderCircle size={16} className="spin" /> Carregando convite…</p> : invitation ? (
          <>
            <h1>Convite para reunião</h1>
            <p>Olá, {invitation.nome}. Você foi convidado(a) para:</p>
            <h2>{invitation.agenda.titulo}</h2>
            <div className="meeting-rsvp-detail"><CalendarDays size={17} />{new Date(invitation.agenda.dataHora).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Bahia" })}</div>
            {invitation.agenda.localOuLink && <div className="meeting-rsvp-detail"><MapPin size={17} />{invitation.agenda.localOuLink}</div>}
            {invitation.agenda.status === "CANCELADA" ? <p className="meeting-rsvp-error">Esta reunião foi cancelada.</p> : (
              <>
                <p className="meeting-rsvp-status">Resposta atual: {invitation.confirmacao === "PENDENTE" ? "Aguardando confirmação" : invitation.confirmacao === "CONFIRMADO" ? "Presença confirmada" : "Convite recusado"}</p>
                {message && <p className="meeting-rsvp-success" role="status"><Check size={16} />{message}</p>}
                <div className="meeting-rsvp-actions">
                  <button className="button button-primary" type="button" disabled={saving} onClick={() => void respond("CONFIRMADO")}><Check size={16} /> Confirmar presença</button>
                  <button className="button button-secondary" type="button" disabled={saving} onClick={() => void respond("RECUSADO")}><X size={16} /> Recusar</button>
                </div>
              </>
            )}
          </>
        ) : <div className="meeting-rsvp-error"><CircleAlert size={17} />{error || "Este convite não está disponível."}</div>}
        {error && invitation && <p className="meeting-rsvp-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
