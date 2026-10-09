import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";
import type { AuthenticatedUser, PermissionAction } from "@/lib/rbac";

export const sumulaStatuses = ["RASCUNHO", "ENVIADA", "FINALIZADA"] as const;
export const decisionStatuses = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO"] as const;

export function isSumulaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sumulaVisibilityWhere(userId: string) {
  return {
    OR: [
      { privada: false },
      { autorId: userId },
      { participantes: { some: { userId } } },
    ],
  };
}

export function authorizeSumulaAction(request: Request, action: PermissionAction) {
  return autorizarApi(request, "sumulas", action);
}

export async function authorizeSumulaRecord(
  request: Request,
  id: string,
  action: "view" | "edit" | "delete",
) {
  const permissionAction = action === "view" ? "visualizar" : action === "edit" ? "editar" : "excluir";
  const authorization = await authorizeSumulaAction(request, permissionAction);
  if ("response" in authorization) return authorization;

  try {
    const sumula = await obterPrisma().meetingSumula.findFirst({
      where: {
        id,
        ...(action === "view" ? sumulaVisibilityWhere(authorization.user.id) : { autorId: authorization.user.id }),
      },
      select: { id: true, autorId: true },
    });
    if (!sumula) {
      return { response: NextResponse.json({ error: "Súmula não encontrada." }, { status: 404 }) };
    }
    return { user: authorization.user, prisma: obterPrisma(), sumula };
  } catch (error) {
    console.error("Falha ao autorizar acesso à súmula:", error);
    return { response: NextResponse.json({ error: "Não foi possível validar o acesso à súmula." }, { status: 500 }) };
  }
}

type SumulaInput = {
  titulo: string;
  dataReuniao: Date;
  privada: boolean;
  agendaId: string | null;
  status: (typeof sumulaStatuses)[number];
  participantes: Array<{
    userId: string | null;
    nome: string;
    email: string;
    presencaConfirmada: boolean;
  }>;
  decisoes: Array<{
    assunto: string;
    deliberacao: string;
    responsavelNome: string;
    responsavelEmail: string;
    prazo: Date | null;
    status: (typeof decisionStatuses)[number];
  }>;
};

export function parseSumulaInput(value: unknown): SumulaInput | { error: string } {
  if (!isSumulaRecord(value)) return { error: "Corpo da requisição inválido." };

  const titulo = typeof value.titulo === "string" ? value.titulo.trim() : "";
  const dataReuniao = typeof value.dataReuniao === "string" ? new Date(value.dataReuniao) : new Date(NaN);
  const privada = value.privada;
  const agendaId = value.agendaId === null || value.agendaId === "" || value.agendaId === undefined
    ? null
    : typeof value.agendaId === "string" ? value.agendaId : undefined;
  const status = value.status ?? "RASCUNHO";
  const participantesInput = value.participantes ?? [];
  const decisoesInput = value.decisoes ?? [];

  if (!titulo || titulo.length > 240 || /[\u0000-\u001f\u007f]/.test(titulo) || Number.isNaN(dataReuniao.getTime())) {
    return { error: "Informe um título de até 240 caracteres e uma data de reunião válida." };
  }
  if (typeof privada !== "boolean") return { error: "A opção de privacidade é inválida." };
  if (agendaId === undefined || (agendaId !== null && !agendaId.trim())) {
    return { error: "A agenda vinculada é inválida." };
  }
  if (!sumulaStatuses.includes(status as (typeof sumulaStatuses)[number])) {
    return { error: "O status informado é inválido." };
  }
  if (!Array.isArray(participantesInput) || participantesInput.length > 200) {
    return { error: "A lista de participantes é inválida." };
  }
  if (!Array.isArray(decisoesInput) || decisoesInput.length > 200) {
    return { error: "A lista de decisões é inválida." };
  }

  const participantes: SumulaInput["participantes"] = [];
  const participantEmails = new Set<string>();
  for (const participant of participantesInput) {
    if (!isSumulaRecord(participant)) return { error: "Um participante contém dados inválidos." };
    const nome = typeof participant.nome === "string" ? participant.nome.trim() : "";
    const email = typeof participant.email === "string" ? participant.email.trim().toLocaleLowerCase("pt-BR") : "";
    const userId = typeof participant.userId === "string" && participant.userId.trim()
      ? participant.userId.trim()
      : null;
    if (!nome || nome.length > 160 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof participant.presencaConfirmada !== "boolean") {
      return { error: "Confira nome, e-mail e presença de cada participante." };
    }
    if (participantEmails.has(email)) return { error: "Não inclua o mesmo e-mail mais de uma vez." };
    participantEmails.add(email);
    participantes.push({ userId, nome, email, presencaConfirmada: participant.presencaConfirmada });
  }

  const decisoes: SumulaInput["decisoes"] = [];
  for (const decision of decisoesInput) {
    if (!isSumulaRecord(decision)) return { error: "Uma decisão contém dados inválidos." };
    const assunto = typeof decision.assunto === "string" ? decision.assunto.trim() : "";
    const deliberacao = typeof decision.deliberacao === "string" ? decision.deliberacao.trim() : "";
    const responsavelNome = typeof decision.responsavelNome === "string" ? decision.responsavelNome.trim() : "";
    const responsavelEmail = typeof decision.responsavelEmail === "string"
      ? decision.responsavelEmail.trim().toLocaleLowerCase("pt-BR")
      : "";
    const prazo = decision.prazo === null || decision.prazo === "" || decision.prazo === undefined
      ? null
      : typeof decision.prazo === "string" ? new Date(decision.prazo) : new Date(NaN);
    const decisionStatus = decision.status ?? "PENDENTE";
    if (!assunto || assunto.length > 240 || !deliberacao || deliberacao.length > 10000 ||
      !responsavelNome || responsavelNome.length > 160 || responsavelEmail.length > 254 ||
      (responsavelEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responsavelEmail)) ||
      (prazo !== null && Number.isNaN(prazo.getTime())) ||
      !decisionStatuses.includes(decisionStatus as (typeof decisionStatuses)[number])) {
      return { error: "Confira o assunto, a deliberação, o responsável e o prazo de cada decisão." };
    }
    decisoes.push({
      assunto,
      deliberacao,
      responsavelNome,
      responsavelEmail,
      prazo,
      status: decisionStatus as SumulaInput["decisoes"][number]["status"],
    });
  }

  return {
    titulo,
    dataReuniao,
    privada,
    agendaId,
    status: status as SumulaInput["status"],
    participantes,
    decisoes,
  };
}

export async function validateAgendaLink(agendaId: string | null, user: AuthenticatedUser) {
  if (!agendaId) return null;
  const agenda = await obterPrisma().meetingAgenda.findFirst({
    where: {
      id: agendaId,
      OR: [
        { privada: false },
        { criadorId: user.id },
        { participantes: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });
  return agenda ? null : "A agenda vinculada não existe ou não está disponível para você.";
}

export async function normalizeSumulaParticipants(
  participants: SumulaInput["participantes"],
) {
  const userIds = [...new Set(participants.flatMap(({ userId }) => userId ? [userId] : []))];
  if (userIds.length === 0) return participants;
  const users = await obterPrisma().user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true, email: true },
  });
  if (users.length !== userIds.length) return null;
  const usersById = new Map(users.map((user) => [user.id, user]));
  const normalized = participants.map((participant) => {
    const user = participant.userId ? usersById.get(participant.userId) : undefined;
    return user
      ? { ...participant, nome: user.nome, email: user.email.toLocaleLowerCase("pt-BR") }
      : participant;
  });
  const emails = new Set<string>();
  const normalizedUserIds = new Set<string>();
  for (const participant of normalized) {
    if (emails.has(participant.email) || (participant.userId && normalizedUserIds.has(participant.userId))) return null;
    emails.add(participant.email);
    if (participant.userId) normalizedUserIds.add(participant.userId);
  }
  return normalized;
}
