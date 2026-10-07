import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { can, type AuthenticatedUser, type PermissionAction } from "@/lib/rbac";
import { obterSessaoDaRequisicao } from "@/lib/auth";
import { obterPrisma } from "@/lib/prisma";

export const meetingStatuses = ["RASCUNHO", "AGENDADA", "REALIZADA", "CANCELADA"] as const;
export const participantConfirmations = ["PENDENTE", "CONFIRMADO", "RECUSADO"] as const;

export type MeetingInput = {
  titulo: string;
  dataHora: Date;
  localOuLink: string | null;
  privada: boolean;
  pauta: string[];
  status: (typeof meetingStatuses)[number];
  participantes: Array<{
    tipo: "INTERNO" | "EXTERNO";
    userId: string | null;
    nome: string;
    email: string;
  }>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function meetingVisibilityWhere(userId: string) {
  return {
    OR: [
      { privada: false },
      { criadorId: userId },
      { participantes: { some: { userId } } },
    ],
  };
}

export async function authorizeMeetingAction(request: Request, action: PermissionAction) {
  return autorizarApi(request, "reunioes", action);
}

export async function authorizeMeetingRecord(
  request: Request,
  agendaId: string,
  action: "view" | "edit" | "delete",
) {
  try {
    const user = await obterSessaoDaRequisicao(request);
    if (!user) {
      return { response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }) } as const;
    }
    const permissionAction = action === "view" ? "visualizar" : action === "edit" ? "editar" : "excluir";
    if (!can(user.permissoes, "reunioes", permissionAction)) {
      return { response: NextResponse.json({ error: "Seu perfil não possui permissão para esta ação." }, { status: 403 }) } as const;
    }
    const prisma = obterPrisma();
    const agenda = await prisma.meetingAgenda.findFirst({
      where: {
        id: agendaId,
        ...(action === "view" ? meetingVisibilityWhere(user.id) : { criadorId: user.id }),
      },
      select: { id: true, criadorId: true, status: true },
    });
    if (!agenda) {
      return { response: NextResponse.json({ error: "Agenda não encontrada." }, { status: 404 }) } as const;
    }
    return { user, prisma, agenda } as const;
  } catch (error) {
    console.error("Falha ao autorizar acesso à agenda:", error);
    return { response: NextResponse.json({ error: "Não foi possível validar o acesso à agenda." }, { status: 500 }) } as const;
  }
}

export function parseMeetingInput(value: unknown): MeetingInput | { error: string } {
  if (!isRecord(value)) return { error: "Corpo da requisição inválido." };
  const titulo = typeof value.titulo === "string" ? value.titulo.trim() : "";
  const dateValue = typeof value.dataHora === "string" ? value.dataHora : "";
  const dataHora = new Date(dateValue);
  const localOuLink = value.localOuLink === null || value.localOuLink === ""
    ? null
    : typeof value.localOuLink === "string" ? value.localOuLink.trim() : undefined;
  const privada = value.privada;
  const pauta = value.pauta;
  const status = value.status ?? "AGENDADA";
  const participantsValue = value.participantes ?? [];

  if (!titulo || titulo.length > 240 || /[\u0000-\u001f\u007f]/.test(titulo) || Number.isNaN(dataHora.getTime())) {
    return { error: "Informe um título de até 240 caracteres e uma data/hora válida." };
  }
  if (localOuLink === undefined || (localOuLink && localOuLink.length > 500)) {
    return { error: "O local ou link informado é inválido." };
  }
  if (typeof privada !== "boolean") return { error: "A opção de privacidade é inválida." };
  if (!meetingStatuses.includes(status as (typeof meetingStatuses)[number])) {
    return { error: "O status informado é inválido." };
  }
  if (!Array.isArray(pauta) || pauta.length > 100 ||
    !pauta.every((topic) => typeof topic === "string" && topic.trim().length > 0 && topic.trim().length <= 500)) {
    return { error: "A pauta deve conter tópicos textuais válidos, com até 500 caracteres cada." };
  }
  if (!Array.isArray(participantsValue) || participantsValue.length > 100) {
    return { error: "A lista de participantes é inválida." };
  }

  const participantes: MeetingInput["participantes"] = [];
  const participantIds = new Set<string>();
  const participantEmails = new Set<string>();
  for (const participant of participantsValue) {
    if (!isRecord(participant)) return { error: "Um participante contém dados inválidos." };
    const tipo = participant.tipo;
    const userId = typeof participant.userId === "string" && participant.userId ? participant.userId : null;
    const nome = typeof participant.nome === "string" ? participant.nome.trim() : "";
    const email = typeof participant.email === "string" ? participant.email.trim().toLocaleLowerCase("pt-BR") : "";
    if (tipo !== "INTERNO" && tipo !== "EXTERNO") {
      return { error: "Confira o tipo, nome e e-mail de cada participante." };
    }
    if (tipo === "INTERNO") {
      if (!userId || participantIds.has(userId)) return { error: "Não inclua o mesmo participante interno mais de uma vez." };
      participantIds.add(userId);
    } else {
      if (userId || !nome || nome.length > 160 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Confira o nome e o e-mail do participante externo." };
      }
      if (participantEmails.has(email)) return { error: "Não inclua o mesmo e-mail mais de uma vez." };
      participantEmails.add(email);
    }
    participantes.push({ tipo, userId, nome, email });
  }

  return {
    titulo,
    dataHora,
    localOuLink,
    privada,
    pauta: pauta.map((topic) => topic.trim()),
    status: status as MeetingInput["status"],
    participantes,
  };
}

export async function normalizeMeetingParticipants(
  participants: MeetingInput["participantes"],
  actor: AuthenticatedUser,
) {
  if (participants.length === 0) return { data: [] as MeetingInput["participantes"] };
  const internalIds = participants.flatMap((participant) => participant.userId ? [participant.userId] : []);
  const users = await obterPrisma().user.findMany({
    where: { id: { in: internalIds }, ativo: true },
    select: { id: true, nome: true, email: true },
  });
  if (users.length !== internalIds.length) {
    return { error: "Um ou mais participantes internos não existem ou estão inativos." };
  }
  const userById = new Map(users.map((user) => [user.id, user]));
  const data = participants.map((participant) => {
      const user = participant.userId ? userById.get(participant.userId) : null;
      return {
        tipo: participant.tipo,
        userId: participant.userId,
        nome: user?.nome ?? participant.nome,
        email: (user?.email ?? participant.email).toLocaleLowerCase("pt-BR"),
        confirmacao: "PENDENTE",
        tokenConfirmacao: randomBytes(32).toString("base64url"),
      };
    }).filter((participant) => participant.userId !== actor.id);
  const emails = new Set<string>();
  for (const participant of data) {
    if (emails.has(participant.email)) return { error: "Não inclua o mesmo e-mail mais de uma vez." };
    emails.add(participant.email);
  }
  return { data };
}
