import "server-only";

import nodemailer from "nodemailer";
import type { MeetingAgenda, MeetingParticipant } from "@prisma/client";

type AgendaForMail = Pick<MeetingAgenda, "titulo" | "dataHora" | "localOuLink" | "pauta">;
type ParticipantForMail = Pick<MeetingParticipant, "nome" | "email" | "tokenConfirmacao">;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`A variável ${name} não está configurada no servidor.`);
  return value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendMeetingInvitation(
  agenda: AgendaForMail,
  participant: ParticipantForMail,
) {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(requiredEnv("SMTP_PORT"));
  const user = requiredEnv("SMTP_USER");
  const password = requiredEnv("SMTP_PASSWORD");
  const from = requiredEnv("SMTP_FROM");
  const baseUrl = requiredEnv("APP_BASE_URL").replace(/\/+$/, "");
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error("APP_BASE_URL deve conter uma URL absoluta válida.");
  }
  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error("APP_BASE_URL deve usar HTTP ou HTTPS.");
  }
  const localHttpAllowed = process.env.NODE_ENV !== "production" &&
    parsedBaseUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname);
  if (parsedBaseUrl.protocol !== "https:" && !localHttpAllowed) {
    throw new Error("APP_BASE_URL deve usar HTTPS fora do ambiente local de desenvolvimento.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT deve ser uma porta válida.");
  }
  if (process.env.SMTP_SECURE && !["true", "false"].includes(process.env.SMTP_SECURE)) {
    throw new Error("SMTP_SECURE deve ser true ou false.");
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const rsvpUrl = `${baseUrl}/reunioes/confirmar?token=${encodeURIComponent(participant.tokenConfirmacao)}`;
  const meetingDate = agenda.dataHora.toLocaleString("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Bahia",
  });
  const agendaTopics = Array.isArray(agenda.pauta)
    ? agenda.pauta.filter((topic): topic is string => typeof topic === "string")
    : [];
  const safeTitle = escapeHtml(agenda.titulo);
  const safeName = escapeHtml(participant.nome);
  const safeLocation = agenda.localOuLink ? escapeHtml(agenda.localOuLink) : "A definir";
  const topicsHtml = agendaTopics.length
    ? `<ol>${agendaTopics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")}</ol>`
    : "<p>Pauta não informada.</p>";
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
  });

  await transporter.sendMail({
    from,
    to: participant.email,
    subject: `Convite: ${agenda.titulo}`,
    text: [
      `Olá, ${participant.nome}.`,
      `Você foi convidado(a) para: ${agenda.titulo}`,
      `Data e hora: ${meetingDate}`,
      `Local ou link: ${agenda.localOuLink ?? "A definir"}`,
      "Pauta:",
      ...(agendaTopics.length ? agendaTopics.map((topic, index) => `${index + 1}. ${topic}`) : ["Pauta não informada."]),
      `Confirme sua presença: ${rsvpUrl}`,
    ].join("\n"),
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17283d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:12px;padding:28px"><tr><td><p>Olá, ${safeName}.</p><h1 style="color:#002654;font-size:22px">Convite para reunião</h1><h2 style="font-size:19px">${safeTitle}</h2><p><strong>Data e hora:</strong> ${escapeHtml(meetingDate)}</p><p><strong>Local ou link:</strong> ${safeLocation}</p><h3>Pauta</h3>${topicsHtml}<p style="margin:28px 0"><a href="${escapeHtml(rsvpUrl)}" style="display:inline-block;background:#002654;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Confirmar presença</a></p><p style="color:#566578;font-size:12px">Na página de confirmação, você também poderá recusar o convite.</p></td></tr></table></td></tr></table></body></html>`,
  });
}
