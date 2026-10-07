import { NextResponse } from "next/server";
import { authorizeMeetingAction, meetingStatuses, meetingVisibilityWhere, normalizeMeetingParticipants, parseMeetingInput } from "@/lib/meeting-agendas";
import { obterPrisma } from "@/lib/prisma";

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

export async function GET(request: Request) {
  const authorization = await authorizeMeetingAction(request, "visualizar");
  if ("response" in authorization) return authorization.response;
  try {
    const status = new URL(request.url).searchParams.get("status");
    if (status && !meetingStatuses.includes(status as (typeof meetingStatuses)[number])) {
      return NextResponse.json({ error: "Filtro de status inválido." }, { status: 400 });
    }
    const agendas = await obterPrisma().meetingAgenda.findMany({
      where: {
        ...meetingVisibilityWhere(authorization.user.id),
        ...(status ? { status } : {}),
      },
      select: agendaSelect,
      orderBy: [{ dataHora: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ agendas }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao listar agendas de reuniões:", error);
    return NextResponse.json({ error: "Não foi possível carregar as agendas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMeetingAction(request, "criar");
  if ("response" in authorization) return authorization.response;
  try {
    const body: unknown = await request.json();
    const parsed = parseMeetingInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const participants = await normalizeMeetingParticipants(parsed.participantes, authorization.user);
    if ("error" in participants) return NextResponse.json({ error: participants.error }, { status: 400 });
    const agenda = await obterPrisma().meetingAgenda.create({
      data: {
        titulo: parsed.titulo,
        dataHora: parsed.dataHora,
        localOuLink: parsed.localOuLink,
        privada: parsed.privada,
        pauta: parsed.pauta,
        status: parsed.status,
        criadorId: authorization.user.id,
        participantes: { create: participants.data },
      },
      select: agendaSelect,
    });
    return NextResponse.json({ agenda }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar agenda de reunião:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível criar a agenda." }, { status: 500 });
  }
}
