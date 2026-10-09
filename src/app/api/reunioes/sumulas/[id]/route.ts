import { NextResponse } from "next/server";
import {
  authorizeSumulaRecord,
  normalizeSumulaParticipants,
  parseSumulaInput,
  validateAgendaLink,
} from "@/lib/meeting-sumulas";

type RouteContext = { params: Promise<{ id: string }> };

const select = {
  id: true,
  codigo: true,
  titulo: true,
  dataReuniao: true,
  privada: true,
  status: true,
  agendaId: true,
  autorId: true,
  createdAt: true,
  updatedAt: true,
  autor: { select: { id: true, nome: true } },
  agenda: { select: { id: true, titulo: true, dataHora: true } },
  participantes: {
    select: { id: true, userId: true, nome: true, email: true, presencaConfirmada: true },
    orderBy: { nome: "asc" },
  },
  decisoes: {
    select: {
      id: true,
      assunto: true,
      deliberacao: true,
      responsavelNome: true,
      responsavelEmail: true,
      prazo: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeSumulaRecord(request, id, "view");
  if ("response" in access) return access.response;
  try {
    const sumula = await access.prisma.meetingSumula.findUnique({ where: { id }, select });
    if (!sumula) return NextResponse.json({ error: "Súmula não encontrada." }, { status: 404 });
    return NextResponse.json({ sumula }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao carregar súmula:", error);
    return NextResponse.json({ error: "Não foi possível carregar a súmula." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeSumulaRecord(request, id, "edit");
  if ("response" in access) return access.response;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }
    const parsed = parseSumulaInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const agendaError = await validateAgendaLink(parsed.agendaId, access.user);
    if (agendaError) return NextResponse.json({ error: agendaError }, { status: 400 });
    const participants = await normalizeSumulaParticipants(parsed.participantes);
    if (!participants) return NextResponse.json({ error: "Um ou mais participantes vinculados não existem." }, { status: 400 });
    const sumula = await access.prisma.$transaction(async (transaction) => {
      await transaction.meetingSumulaParticipant.deleteMany({ where: { sumulaId: id } });
      await transaction.meetingDecision.deleteMany({ where: { sumulaId: id } });
      return transaction.meetingSumula.update({
        where: { id },
        data: {
          titulo: parsed.titulo,
          dataReuniao: parsed.dataReuniao,
          privada: parsed.privada,
          status: parsed.status,
          agendaId: parsed.agendaId,
          participantes: { create: participants },
          decisoes: { create: parsed.decisoes },
        },
        select,
      });
    });
    return NextResponse.json({ sumula });
  } catch (error) {
    console.error("Falha ao atualizar súmula:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar a súmula." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeSumulaRecord(request, id, "delete");
  if ("response" in access) return access.response;
  try {
    await access.prisma.meetingSumula.delete({ where: { id } });
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Falha ao excluir súmula:", error);
    return NextResponse.json({ error: "Não foi possível excluir a súmula." }, { status: 500 });
  }
}
