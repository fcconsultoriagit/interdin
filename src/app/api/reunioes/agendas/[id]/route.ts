import { NextResponse } from "next/server";
import { authorizeMeetingRecord, isRecord, normalizeMeetingParticipants, parseMeetingInput } from "@/lib/meeting-agendas";
import { deleteMeetingAttachmentsForAgenda } from "@/lib/meeting-attachments";

type RouteContext = { params: Promise<{ id: string }> };

const agendaSelect = {
  id: true,
  titulo: true,
  dataHora: true,
  localOuLink: true,
  privada: true,
  pauta: true,
  status: true,
  criadorId: true,
  sumulaId: true,
  createdAt: true,
  updatedAt: true,
  criador: { select: { id: true, nome: true } },
  participantes: {
    select: {
      id: true,
      tipo: true,
      userId: true,
      nome: true,
      email: true,
      confirmacao: true,
    },
    orderBy: { nome: "asc" },
  },
  anexos: {
    select: { id: true, nome: true, url: true, tamanho: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  },
} as const;

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeMeetingRecord(request, id, "view");
  if ("response" in access) return access.response;
  try {
    const agenda = await access.prisma.meetingAgenda.findUnique({ where: { id }, select: agendaSelect });
    if (!agenda) return NextResponse.json({ error: "Agenda não encontrada." }, { status: 404 });
    return NextResponse.json({ agenda }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao carregar agenda de reunião:", error);
    return NextResponse.json({ error: "Não foi possível carregar a agenda." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeMeetingRecord(request, id, "edit");
  if ("response" in access) return access.response;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    const parsed = parseMeetingInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const participants = await normalizeMeetingParticipants(parsed.participantes, access.user);
    if ("error" in participants) return NextResponse.json({ error: participants.error }, { status: 400 });
    const agenda = await access.prisma.$transaction(async (transaction) => {
      const existingParticipants = await transaction.meetingParticipant.findMany({
        where: { agendaId: id },
        select: { tipo: true, userId: true, email: true, confirmacao: true, tokenConfirmacao: true },
      });
      const previousByContact = new Map(existingParticipants.map((participant) => [
        `${participant.tipo}:${participant.userId ?? participant.email.toLocaleLowerCase("pt-BR")}`,
        participant,
      ]));
      const participantRecords = participants.data.map((participant) => {
        const previous = previousByContact.get(`${participant.tipo}:${participant.userId ?? participant.email.toLocaleLowerCase("pt-BR")}`);
        return {
          ...participant,
          ...(previous ? {
            confirmacao: previous.confirmacao,
            tokenConfirmacao: previous.tokenConfirmacao,
          } : {}),
        };
      });
      await transaction.meetingParticipant.deleteMany({ where: { agendaId: id } });
      return transaction.meetingAgenda.update({
        where: { id },
        data: {
          titulo: parsed.titulo,
          dataHora: parsed.dataHora,
          localOuLink: parsed.localOuLink,
          privada: parsed.privada,
          pauta: parsed.pauta,
          status: parsed.status,
          participantes: { create: participantRecords },
        },
        select: agendaSelect,
      });
    });
    return NextResponse.json({ agenda });
  } catch (error) {
    console.error("Falha ao atualizar agenda de reunião:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar a agenda." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeMeetingRecord(request, id, "delete");
  if ("response" in access) return access.response;
  try {
    await deleteMeetingAttachmentsForAgenda(access.prisma, id);
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Falha ao excluir agenda de reunião:", error);
    return NextResponse.json({ error: "Não foi possível excluir a agenda." }, { status: 500 });
  }
}
